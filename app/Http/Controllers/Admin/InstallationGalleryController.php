<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsModelProduct;
use App\Models\CmsPage;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Services\ActivityLogService;
use App\Support\InstallationPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InstallationGalleryController extends Controller
{
    public const STATUS_TABS = [
        ['key' => 'all', 'label' => 'Semua Hasil Pemasangan'],
        ['key' => 'active', 'label' => 'Hasil Pemasangan Aktif'],
        ['key' => 'inactive', 'label' => 'Hasil Pemasangan Nonaktif'],
        ['key' => 'archived', 'label' => 'Hasil Pemasangan Diarsipkan'],
    ];

    public function index(Request $request): Response
    {
        $status = (string) $request->query('status', 'all');
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'order');
        $view = (string) $request->query('view', 'list');

        $media = \App\Support\InstallationGallery::installationMedia();

        // Grouping: satu baris per model produk (Kasus A+B) + satu grup
        // mandiri (Kasus C) — bukan per media agar daftar tetap ringkas.
        $groups = collect();

        // Grup terhitung aktif bila minimal satu medianya visible; grup masuk
        // tab Nonaktif/Diarsipkan hanya bila SEMUA medianya dalam status itu.
        $groupVisibility = function ($rows): string {
            if ($rows->contains('visibility', 'visible')) {
                return 'visible';
            }
            if ($rows->contains('visibility', 'hidden')) {
                return 'hidden';
            }

            return 'archived';
        };

        // Urutan tampil grup: cms_model_products.installation_sort_order utk
        // grup model, installation_groups.sort_order utk grup mandiri.
        // Urut default = urutan storefront (sort_order model / judul mandiri).
        $standaloneGroups = \App\Models\InstallationGroup::pluck('sort_order', 'id');
        $modelSortOrders = \App\Models\CmsModelProduct::query()
            ->get(['id', 'product_category', 'product_model', 'installation_sort_order'])
            ->keyBy(fn ($m) => strtoupper((string) $m->product_category) . '|' . strtoupper((string) $m->product_model));

        foreach ($media->where('placement', 'product')->groupBy('model_label') as $modelLabel => $rows) {
            $pairKey = strtoupper((string) $rows->first()['category']) . '|' . strtoupper((string) $rows->first()['model']);
            $modelRow = $modelSortOrders->get($pairKey);

            $groups->push([
                'key' => 'model|'.$rows->first()['category'].'|'.$rows->first()['model'],
                'kind' => 'model',
                'label' => $modelLabel,
                'category' => $rows->first()['category'],
                'model' => $rows->first()['model'],
                'media_count' => $rows->count(),
                'video_count' => $rows->where('is_video', true)->count(),
                'sku_count' => $rows->where('product_sku', '!==', '')->unique('product_sku')->count(),
                'cover' => $rows->first()['thumb'],
                'visibility' => $groupVisibility($rows),
                'sort_order' => $modelRow?->installation_sort_order ?? 0,
                'detailUrl' => route('admin.hasil-pemasangan.show', [
                    'group' => $rows->first()['category'].'|'.$rows->first()['model'],
                ]),
            ]);
        }

        // Grup mandiri: satu baris per installation_groups (judul admin),
        // bukan satu baris generik "Grup mandiri" untuk semuanya.
        $standalone = $media->where('placement', 'standalone');
        $standaloneByGroup = $standalone->groupBy('installation_group_id');
        foreach ($standaloneByGroup as $groupId => $rows) {
            $groupTitle = \App\Models\InstallationGroup::find($groupId)?->title
                ?: ($rows->first()['caption'] ?: 'Grup mandiri');

            $groups->push([
                'key' => 'group|'.$groupId,
                'kind' => 'standalone',
                'label' => $groupTitle,
                'category' => 'LAINNYA',
                'model' => 'STANDALONE',
                'media_count' => $rows->count(),
                'video_count' => $rows->where('is_video', true)->count(),
                'sku_count' => 0,
                'cover' => $rows->first()['thumb'],
                'visibility' => $groupVisibility($rows),
                'sort_order' => (int) ($standaloneGroups[(int) $groupId] ?? 0),
                'detailUrl' => route('admin.hasil-pemasangan.show', ['group' => 'group|'.$groupId]),
            ]);
        }

        $tabCounts = [
            'all' => $groups->count(),
            'active' => $groups->where('visibility', 'visible')->count(),
            'inactive' => $groups->where('visibility', 'hidden')->count(),
            'archived' => $groups->where('visibility', 'archived')->count(),
        ];

        $tabs = collect(self::STATUS_TABS)->map(function (array $tab) use ($tabCounts) {
            return [
                'key' => $tab['key'],
                'label' => $tab['label'],
                'count' => $tabCounts[$tab['key']] ?? 0,
            ];
        })->values()->all();

        // Map tab key -> nilai visibility sebenarnya (tab "active" = visible).
        $statusMap = [
            'all' => 'all',
            'active' => 'visible',
            'inactive' => 'hidden',
            'archived' => 'archived',
            // Guard: tab lama/other key fallback aman
        ];
        $visibilityFilter = $statusMap[$status] ?? 'all';

        $rows = $groups
            ->when($visibilityFilter !== 'all', fn ($collection) => $collection->filter(
                fn ($item) => $item['visibility'] === $visibilityFilter,
            ))
            ->when($q !== '', fn ($collection) => $collection->filter(function ($item) use ($q) {
                $needle = mb_strtolower($q);

                return str_contains(mb_strtolower((string) $item['label']), $needle)
                    || str_contains(mb_strtolower((string) $item['category']), $needle);
            }))
            ->when($sort === 'latest', fn ($collection) => $collection->sortByDesc('label')->values())
            ->when($sort !== 'latest', fn ($collection) => $collection->sortBy([['sort_order'], ['label']])->values())
            ->values();

        return Inertia::render('Admin/InstallationGallery/Index', [
            'title' => 'Hasil Pemasangan',
            'description' => 'Grup hasil pemasangan per model produk dan grup mandiri. Klik Detail untuk melihat media di dalamnya.',
            'projects' => [
                'data' => $rows->all(),
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => max(1, $rows->count()),
                'total' => $rows->count(),
                'from' => $rows->count() ? 1 : null,
                'to' => $rows->count(),
                'links' => [],
            ],
            'tabs' => $tabs,
            'activeStatus' => $status,
            'viewMode' => in_array($view, ['list', 'grid'], true) ? $view : 'list',
            'sort' => $sort,
            'q' => $q,
            'createUrl' => route('admin.hasil-pemasangan.create'),
            'reorderUrl' => route('admin.hasil-pemasangan.reorder'),
            'previewUrl' => route('installation.index'),
        ]);
    }

    /** Detail satu grup: daftar media hasil pemasangan di dalamnya. */
    public function show(Request $request): Response
    {
        $group = (string) $request->query('group', '');

        if (str_starts_with($group, 'group|')) {
            // Grup mandiri berdasarkan installation_groups.
            $groupId = (int) substr($group, strlen('group|'));
            $groupTitle = \App\Models\InstallationGroup::find($groupId)?->title ?? 'Grup mandiri';
            $media = \App\Support\InstallationGallery::installationMedia()
                ->where('placement', 'standalone')
                ->filter(fn (array $m) => ($m['installation_group_id'] ?? null) === $groupId)
                ->values();
            $label = $groupTitle;
        } else {
            $parts = explode('|', $group);
            $category = strtoupper($parts[0] ?? '');
            $modelCode = strtoupper($parts[1] ?? '');
            $media = \App\Support\InstallationGallery::installationMedia()
                ->where('category', $category)
                ->where('model', $modelCode)
                ->sortByDesc('id')
                ->values();
            $label = filled($modelCode) && $modelCode !== 'STANDALONE'
                ? \App\Support\CatalogLabels::modelCardTitle($category, $modelCode)
                : 'Lainnya';
        }

        $rows = $media->map(fn (array $m) => [
            'id' => $m['id'],
            'media_id' => $m['media_id'],
            'url' => $m['url'],
            'thumb' => $m['thumb'],
            'is_video' => $m['is_video'],
            'caption' => $m['caption'],
            'visibility' => $m['visibility'],
            'product_sku' => $m['product_sku'],
            'product_name' => $m['product_name'],
            'created_at' => $m['created_at'],
            'toggleStatusUrl' => route('admin.hasil-pemasangan.toggle-status', $m['media_id']),
            'archiveUrl' => route('admin.hasil-pemasangan.archive', $m['media_id']),
            'destroyUrl' => route('admin.hasil-pemasangan.destroy', $m['media_id']),
        ])->values()->all();

        return Inertia::render('Admin/InstallationGallery/Show', [
            'title' => $label,
            'group' => [
                'label' => $label,
                'group' => $group,
                'media' => $rows,
            ],
            'backUrl' => route('admin.hasil-pemasangan.index'),
        ]);
    }

    public function create(): Response
    {
        $allProducts = Product::visible()
            ->get(['id', 'name', 'parent_sku', 'product_category', 'product_model'])
            ->groupBy(fn ($p) => strtoupper((string) $p->product_category) . '|' . strtoupper((string) $p->product_model));

        $modelProducts = CmsModelProduct::query()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'product_category', 'product_model'])
            ->map(function ($model) use ($allProducts) {
                $key = strtoupper((string) $model->product_category) . '|' . strtoupper((string) $model->product_model);
                $products = $allProducts->get($key, collect())->values()->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'parent_sku' => $p->parent_sku,
                ]);

                $label = $model->name . ($model->product_category ? ' (' . $model->product_category . ')' : '');

                return [
                    'id' => $model->id,
                    'name' => $model->name,
                    'label' => $label,
                    'category' => $model->product_category,
                    'model' => $model->product_model,
                    'products' => $products,
                ];
            });

        return Inertia::render('Admin/InstallationGallery/Form', [
            'title' => 'Tambah Hasil Pemasangan',
            'modelProducts' => $modelProducts,
            'submitUrl' => route('admin.hasil-pemasangan.store'),
            'backUrl' => route('admin.hasil-pemasangan.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'model_product_id' => ['nullable', 'integer', 'exists:cms_model_products,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'main_image_url' => ['nullable', 'string', 'max:1024'],
            'main_image_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'main_video_url' => ['nullable', 'string', 'max:1024'],
            'main_video_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'gallery_images' => ['nullable', 'array', 'max:60'],
            'gallery_images.*.url' => ['required', 'string', 'max:1024'],
            'gallery_images.*.asset_id' => ['nullable', 'integer'],
            'gallery_images.*.caption' => ['nullable', 'string', 'max:255'],
        ]);

        if (empty($validated['main_image_url']) && empty($validated['main_image_asset_id'])) {
            return back()->withErrors(['main_image_url' => 'Foto utama wajib diunggah atau dipilih.'])->withInput();
        }

        $product = !empty($validated['product_id']) ? Product::find($validated['product_id']) : null;
        $modelProduct = !empty($validated['model_product_id']) ? CmsModelProduct::find($validated['model_product_id']) : null;

        // Validasi konsistensi: SKU harus milik model terpilih (Kasus A),
        // atau tanpa SKU sama sekali (Kasus B/C).
        if ($product && $modelProduct
            && (strtoupper((string) $product->product_category) !== strtoupper((string) $modelProduct->product_category)
                || strtoupper((string) $product->product_model) !== strtoupper((string) $modelProduct->product_model))) {
            return back()->withErrors(['product_id' => 'Produk yang dipilih bukan bagian dari model produk terpilih.'])->withInput();
        }

        // Sumber tunggal: semua media disimpan ke product_media.is_installation.
        // - product_id terisi            -> Kasus A (tampil di model + PDP)
        // - product_id NULL + model_id   -> Kasus B (tampil di model saja)
        // - keduanya NULL                -> Kasus C (grup mandiri, judul wajib)
        $isStandalone = $product === null && $modelProduct === null;

        $title = $validated['title'] ?? null;

        // Grup mandiri: judul wajib, buat/pakai installation_groups.
        $installationGroupId = null;
        if ($isStandalone) {
            if (!filled($title)) {
                return back()->withErrors(['title' => 'Judul grup wajib diisi untuk portofolio mandiri.'])->withInput();
            }

            $installationGroupId = \App\Models\InstallationGroup::query()
                ->where('title', $title)
                ->value('id')
                ?? \App\Models\InstallationGroup::create(['title' => $title])->id;
        }

        $caption = filled($title) && ! $isStandalone
            ? null
            : ($product ? "Hasil pemasangan {$product->name}" : ($modelProduct ? "Hasil pemasangan {$modelProduct->name}" : null));

        $mainMedia = ProductMedia::create([
            'product_id' => $product?->id,
            'model_product_id' => $product ? null : $modelProduct?->id,
            'installation_group_id' => $installationGroupId,
            'media_asset_id' => $validated['main_image_asset_id'] ?? null,
            'stored_url' => $validated['main_image_url'] ?? null,
            'source_url' => $validated['main_image_url'] ?? null,
            'position' => 100,
            'is_installation' => true,
            'installation_caption' => $caption,
            'visibility' => 'visible',
            'status' => 'downloaded',
            'created_by_user_id' => $request->user()?->id,
        ]);

        foreach ($validated['gallery_images'] ?? [] as $idx => $g) {
            ProductMedia::create([
                'product_id' => $product?->id,
                'model_product_id' => $product ? null : $modelProduct?->id,
                'installation_group_id' => $installationGroupId,
                'media_asset_id' => $g['asset_id'] ?? null,
                'stored_url' => $g['url'] ?? null,
                'source_url' => $g['url'] ?? null,
                'position' => 101 + $idx,
                'is_installation' => true,
                'installation_caption' => $g['caption'] ?? $caption,
                'visibility' => 'visible',
                'status' => 'downloaded',
                'created_by_user_id' => $request->user()?->id,
            ]);
        }

        $targetLabel = $product
            ? $product->name
            : ($modelProduct ? $modelProduct->name : ($title ?? 'portofolio mandiri'));

        ActivityLogService::record('installation_media.created', 'product_media', $mainMedia->id, [
            'title' => $targetLabel,
            'placement' => $product ? 'product' : ($modelProduct ? 'model' : 'standalone'),
            'media_count' => 1 + count($validated['gallery_images'] ?? []),
        ], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', "Hasil pemasangan untuk {$targetLabel} berhasil ditambahkan.");
    }

    /** Toggle visibilitas satu media hasil pemasangan (visible <-> hidden). */
    public function toggleStatus(Request $request, ProductMedia $media): RedirectResponse
    {
        abort_unless($media->is_installation, 404);

        $newVisibility = $media->visibility === 'visible' ? 'hidden' : 'visible';
        $media->update(['visibility' => $newVisibility]);

        ActivityLogService::record('installation_media.visibility_toggled', 'product_media', $media->id, ['visibility' => $newVisibility], $request->user()?->id);

        $label = $newVisibility === 'visible' ? 'diaktifkan' : 'disembunyikan';
        return back()->with('success', "Media berhasil {$label}.");
    }

    /** Arsipkan media hasil pemasangan (keluar dari storefront). */
    public function archive(Request $request, ProductMedia $media): RedirectResponse
    {
        abort_unless($media->is_installation, 404);

        $media->update(['visibility' => 'archived']);

        ActivityLogService::record('installation_media.archived', 'product_media', $media->id, ['visibility' => 'archived'], $request->user()?->id);

        return back()->with('success', 'Media berhasil diarsipkan.');
    }

    /** Hapus permanen media hasil pemasangan. */
    public function destroy(Request $request, ProductMedia $media): RedirectResponse
    {
        abort_unless($media->is_installation, 404);

        $mediaId = $media->id;
        $media->delete();

        ActivityLogService::record('installation_media.deleted', 'product_media', $mediaId, [], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', 'Media hasil pemasangan berhasil dihapus.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.key' => ['required', 'string'],
        ]);

        // Key format: "model|{CATEGORY}|{MODEL}" atau "group|{installation_group_id}".
        DB::transaction(function () use ($validated) {
            foreach ($validated['rows'] as $index => $row) {
                $key = (string) $row['key'];
                if (str_starts_with($key, 'model|')) {
                    $parts = explode('|', $key);
                    \App\Models\CmsModelProduct::query()
                        ->where('product_category', strtoupper($parts[1] ?? ''))
                        ->where('product_model', strtoupper($parts[2] ?? ''))
                        ->update(['installation_sort_order' => $index + 1]);
                } elseif (str_starts_with($key, 'group|')) {
                    \App\Models\InstallationGroup::where('id', (int) substr($key, strlen('group|')))
                        ->update(['sort_order' => $index + 1]);
                }
            }
        });

        ActivityLogService::record('installation_group.reordered', 'product_media', null, ['count' => count($validated['rows'])], $request->user()?->id);

        return back()->with('success', 'Urutan grup hasil pemasangan berhasil disimpan.');
    }

    public function model(Request $request): RedirectResponse
    {
        return redirect()->route('admin.hasil-pemasangan.index');
    }

    public function updateMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:1000'],
            'published' => ['required', 'boolean'],
        ]);

        InstallationPageSettings::updatePageMeta($validated);

        ActivityLogService::record('installation_gallery.meta_updated', 'cms_page', 1, ['title' => $validated['title']], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', 'Pengaturan halaman hasil pemasangan diperbarui.');
    }
}
