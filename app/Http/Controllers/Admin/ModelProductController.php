<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsBanner;
use App\Models\CmsGalleryItem;
use App\Models\CmsModelProduct;
use App\Models\MediaAsset;
use App\Models\ProductMedia;
use App\Services\ActivityLogService;
use App\Services\ModelProductService;
use App\Support\CatalogTaxonomy;
use App\Support\CategoryUrl;
use App\Support\InertiaAdmin;
use App\Support\ModelProductPresentation;
use Illuminate\Support\Str;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ModelProductController extends Controller
{
    public function __construct(protected ModelProductService $models) {}

    public function index(Request $request): Response
    {
        $q = trim((string) $request->input('q', ''));
        $status = (string) $request->input('status', '');
        $category = trim((string) $request->input('product_category', ''));
        $view = $request->input('view') === 'grid' ? 'grid' : 'list';

        // Ukuran halaman: hanya 20, 50, 100 yang diterima; nilai lain jatuh ke 20.
        $perPage = (int) $request->input('per_page', 20);
        if (! in_array($perPage, [20, 50, 100], true)) {
            $perPage = 20;
        }

        $rows = $this->models->adminRows(
            $q !== '' ? $q : null,
            in_array($status, CmsModelProduct::STATUSES, true) ? $status : null,
            $category !== '' ? $category : null,
            $perPage,
        )->appends($request->query());

        return Inertia::render('Admin/ModelProducts/Index', [
            'title' => 'Daftar Model Produk',
            'description' => 'Kelola model produk yang tampil sebagai wadah produk di toko.',
            'viewMode' => $view,
            'perPage' => $perPage,
            'pagination' => InertiaAdmin::pagination($rows),
            'filters' => [
                'q' => $q,
                'status' => in_array($status, CmsModelProduct::STATUSES, true) ? $status : '',
                'product_category' => $category,
            ],
            'statusOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => 'active', 'label' => 'Aktif'],
                ['value' => 'draft', 'label' => 'Nonaktif'],
            ],
            'categoryOptions' => array_merge(
                [['value' => '', 'label' => 'Semua kategori']],
                $this->categoryOptions(),
            ),
            'rows' => collect($rows->items())->all(),
            'createHref' => route('admin.model-products.create'),
            'reorderUrl' => route('admin.model-products.reorder'),
            'syncUrl' => route('admin.model-products.sync'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/ModelProducts/Form', [
            'backUrl' => route('admin.model-products.index'),
            'modelProduct' => null,
            'media' => null,
            'gallery' => [],
            'stats' => null,
            'storefrontUrl' => null,
            'productsUrl' => null,
            'maxGallery' => CmsModelProduct::MAX_GALLERY,
            'statuses' => CmsModelProduct::STATUSES,
            'categories' => $this->categoryOptions(),
            'submitUrl' => route('admin.model-products.store'),
            'indexUrl' => route('admin.model-products.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['sort_order'] = $validated['sort_order']
            ?? ((int) CmsModelProduct::query()->max('sort_order') + 1);
        $validated['image_url'] = $this->resolveImageUrl($validated['media_asset_id'] ?? null)
            ?: (($validated['image_url'] ?? null) ?: null);

        $item = CmsModelProduct::create($validated);
        $this->syncGallery($item, $request);
        CatalogTaxonomy::forgetCache();

        ActivityLogService::record(
            'cms.model_product_created',
            'cms_model_product',
            (int) $item->id,
            ['name' => $item->name],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', 'Model produk ditambahkan.');
    }

    public function edit(CmsModelProduct $modelProduct): Response
    {
        $modelProduct->loadMissing(['mediaAsset', 'galleryAssets']);

        return Inertia::render('Admin/ModelProducts/Form', [
            'backUrl' => route('admin.model-products.index'),
            'modelProduct' => [
                'id' => $modelProduct->id,
                'name' => $modelProduct->name,
                'product_category' => $modelProduct->product_category,
                'product_model' => $modelProduct->product_model,
                'image_url' => $modelProduct->image_url,
                'description' => $modelProduct->description,
                'keywords' => $modelProduct->keywords ?? [],
                'status' => $modelProduct->status,
                'sort_order' => $modelProduct->sort_order,
                'media_show_product_photos' => (bool) $modelProduct->media_show_product_photos,
            ],
            'media' => $this->mediaPayload($modelProduct->mediaAsset),
            'gallery' => $modelProduct->galleryAssets
                ->map(fn (MediaAsset $asset) => $this->mediaPayload($asset))
                ->filter()
                ->values()
                ->all(),
            'stats' => $this->models->containerStats($modelProduct),
            // Pill yang dibeli pembeli di storefront saat kata kunci admin kosong:
            // fallback bawaan dari ModelProductPresentation::forModel().
            'defaultHighlights' => collect(ModelProductPresentation::forModel($modelProduct->product_model)['highlights'])
                ->pluck('label')
                ->values()
                ->all(),
            'storefrontUrl' => $this->storefrontUrl($modelProduct),
            'productsUrl' => $this->productsUrl($modelProduct),
            'maxGallery' => CmsModelProduct::MAX_GALLERY,
            'statuses' => CmsModelProduct::STATUSES,
            'categories' => $this->categoryOptions(),
            'submitUrl' => route('admin.model-products.update', $modelProduct),
            'indexUrl' => route('admin.model-products.index'),
        ]);
    }

    public function update(Request $request, CmsModelProduct $modelProduct): RedirectResponse
    {
        $previousAssetId = $modelProduct->media_asset_id ? (int) $modelProduct->media_asset_id : null;

        $validated = $this->validated($request, $modelProduct);
        $validated['image_url'] = $this->resolveImageUrl($validated['media_asset_id'] ?? null)
            ?: (($validated['image_url'] ?? null) ?: null);

        if (($validated['sort_order'] ?? null) === null) {
            unset($validated['sort_order']);
        }

        $modelProduct->update($validated);
        $this->syncGallery($modelProduct, $request);
        $this->archiveReplacedAsset(
            $previousAssetId,
            $modelProduct->media_asset_id ? (int) $modelProduct->media_asset_id : null,
        );
        CatalogTaxonomy::forgetCache();

        ActivityLogService::record(
            'cms.model_product_updated',
            'cms_model_product',
            (int) $modelProduct->id,
            ['name' => $modelProduct->name],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', 'Model produk diperbarui.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:cms_model_products,id'],
            'rows.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $this->models->reorder($validated['rows'], $request->user()?->id);

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', 'Urutan model produk disimpan.');
    }

    public function sync(Request $request): RedirectResponse
    {
        $result = $this->models->syncFromCatalog($request->user()?->id);
        $created = (int) ($result['created'] ?? 0);
        $archived = (int) ($result['archived'] ?? 0);

        $parts = [];
        if ($created > 0) {
            $parts[] = "{$created} model ditambahkan";
        }
        if ($archived > 0) {
            $parts[] = "{$archived} model kosong diarsipkan";
        }

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', $parts !== []
                ? 'Sinkronisasi selesai: '.implode(', ', $parts).'.'
                : 'Semua model katalog sudah ada di daftar.');
    }

    public function activate(CmsModelProduct $modelProduct): RedirectResponse
    {
        $modelProduct->update(['status' => 'active']);
        CatalogTaxonomy::forgetCache();

        return back()->with('success', 'Model dipublikasikan.');
    }

    public function deactivate(CmsModelProduct $modelProduct): RedirectResponse
    {
        $modelProduct->update(['status' => 'draft']);
        CatalogTaxonomy::forgetCache();

        return back()->with('success', 'Model disembunyikan (draft).');
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request, ?CmsModelProduct $existing = null): array
    {
        $usableAsset = fn () => Rule::exists('media_assets', 'id')
            ->whereIn('status', ['pending', 'ready']);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'product_category' => ['required', 'string', Rule::in(CategoryUrl::productCategoryCodes())],
            'image_url' => ['nullable', 'string', 'max:1024'],
            'media_asset_id' => ['nullable', 'integer', $usableAsset()],
            'gallery_asset_ids' => ['nullable', 'array', 'max:'.CmsModelProduct::MAX_GALLERY],
            'gallery_asset_ids.*' => ['nullable', 'integer', 'distinct', $usableAsset()],
            'description' => ['nullable', 'string', 'max:5000'],
            'keywords' => ['nullable', 'array', 'max:6'],
            'keywords.*' => ['nullable', 'string', 'max:64'],
            'status' => ['required', Rule::in(CmsModelProduct::STATUSES)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'media_show_product_photos' => ['nullable', 'boolean'],
        ], [], ['name' => 'Nama tampilan', 'product_category' => 'Kategori produk']);

        $validated['product_category'] = $validated['product_category'] ?: null;
        // Kontrak 2026-09-11 (commit bcae2a6): halaman tambah model produk
        // berarti MENAMBAH, bukan memilih kode model katalog yang sudah ada.
        // Kode dibuat otomatis dari nama saat create; saat edit kode lama
        // dipertahankan agar tautan produk tidak patah.
        $validated['product_model'] = $existing?->product_model
            ?: mb_strtoupper(Str::slug((string) $validated['name'], '_'));
        $validated['media_asset_id'] = $validated['media_asset_id'] ?? null;
        $validated['media_show_product_photos'] = $request->boolean('media_show_product_photos', true);
        $validated['image_url'] = ($validated['image_url'] ?? null) ?: null;
        $validated['description'] = filled($validated['description'] ?? null)
            ? trim((string) $validated['description'])
            : null;
        $validated['keywords'] = array_values(array_filter(
            array_map(
                fn ($row) => trim((string) $row),
                is_array($validated['keywords'] ?? null) ? $validated['keywords'] : [],
            ),
            fn (string $row) => $row !== '',
        )) ?: null;

        // Kontrak owner 2026-09-02: label pill maksimal 2 kata.
        $tooLong = collect($validated['keywords'] ?? [])
            ->first(fn (string $row) => str_word_count($row) > 2);
        if ($tooLong !== null) {
            throw ValidationException::withMessages([
                'keywords' => 'Kata kunci "'.$tooLong.'" lebih dari 2 kata. Gunakan maksimal 2 kata per label pill, atau pilih dari template.',
            ]);
        }
        $validated['sort_order'] = isset($validated['sort_order']) ? (int) $validated['sort_order'] : null;

        unset($validated['gallery_asset_ids']);

        return $validated;
    }

    /**
     * URL gambar utama dari media asset. Asset pending (WebP belum selesai)
     * memakai objek aslinya supaya gambar tetap tampil sejak awal.
     */
    protected function resolveImageUrl(?int $assetId): ?string
    {
        if (! $assetId) {
            return null;
        }

        $asset = MediaAsset::find($assetId);
        if (! $asset) {
            return null;
        }

        $url = $asset->localUrlFor('card');
        if ($url) {
            return $url;
        }

        return $asset->object_key
            ? $asset->publicUrlForPath((string) $asset->object_key)
            : null;
    }

    /** Sinkron galeri model; hanya jalan bila field dikirim form. */
    protected function syncGallery(CmsModelProduct $item, Request $request): void
    {
        if (! $request->exists('gallery_asset_ids')) {
            return;
        }

        $ids = array_values(array_unique(array_map(
            'intval',
            array_filter((array) $request->input('gallery_asset_ids', []), fn ($id) => filled($id)),
        )));

        $sync = [];
        foreach (array_slice($ids, 0, CmsModelProduct::MAX_GALLERY) as $index => $id) {
            $sync[$id] = ['sort_order' => $index];
        }

        $item->galleryAssets()->sync($sync);
    }

    /**
     * Asset utama yang diganti diarsipkan bila tidak dipakai entitas lain,
     * supaya Media Library tidak menumpuk aset yatim (pola BannerController).
     */
    protected function archiveReplacedAsset(?int $previousId, ?int $newId): void
    {
        if (! $previousId || $previousId === $newId) {
            return;
        }

        $usedElsewhere = ProductMedia::where('media_asset_id', $previousId)->exists()
            || CmsBanner::where('media_asset_id', $previousId)->exists()
            || CmsGalleryItem::where('media_asset_id', $previousId)->exists()
            || CmsModelProduct::where('media_asset_id', $previousId)->exists()
            || DB::table('cms_model_product_media')->where('media_asset_id', $previousId)->exists();

        if (! $usedElsewhere) {
            MediaAsset::where('id', $previousId)
                ->where('status', '!=', 'archived')
                ->update(['status' => 'archived']);
        }
    }

    /** Tautan halaman detail model di storefront (null bila kategori/model belum lengkap). */
    protected function storefrontUrl(CmsModelProduct $item): ?string
    {
        if (! $item->product_category || ! $item->product_model) {
            return null;
        }

        return route('catalog.model', [
            'category' => CategoryUrl::categoryToSlug((string) $item->product_category),
            'model' => strtolower(str_replace('_', '-', (string) $item->product_model)),
        ], absolute: false);
    }

    /** Daftar produk admin yang sudah difilter ke wadah model ini. */
    protected function productsUrl(CmsModelProduct $item): ?string
    {
        if (! $item->product_category || ! $item->product_model) {
            return null;
        }

        return route('admin.products.index', [
            'product_category' => $item->product_category,
            'product_model' => $item->product_model,
        ]);
    }

    /** @return array{assetId: int, label: string, thumbUrl: string, kind: string, videoUrl: ?string}|null */
    protected function mediaPayload(?MediaAsset $asset): ?array
    {
        if (! $asset) {
            return null;
        }

        $kind = $asset->kind === 'video' ? 'video' : 'image';

        return [
            'assetId' => (int) $asset->id,
            'label' => (string) ($asset->label ?? ''),
            'thumbUrl' => (string) ($asset->localUrlFor('thumb') ?: $asset->localUrlFor('card') ?: ''),
            'kind' => $kind,
            'videoUrl' => $kind === 'video' ? $asset->localUrlFor('video') : null,
        ];
    }

    /** @return list<array{value:string,label:string}> */
    protected function categoryOptions(): array
    {
        return \App\Models\Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['code', 'name'])
            ->map(fn (\App\Models\Category $c) => [
                'value' => CategoryUrl::codeToProductCode((string) $c->code),
                'label' => (string) $c->name,
            ])
            ->values()
            ->all();
    }
}
