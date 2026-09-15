<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsGalleryItem;
use App\Models\ProductMedia;
use App\Services\ActivityLogService;
use App\Support\InertiaAdmin;
use App\Support\InstallationPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pengaturan Website -> Hasil Pemasangan Kami.
 * Scope terpisah dari menu core Ulasan (TestimonialController).
 */
class InstallationGalleryController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'newest');
        $published = $request->query('published');

        $query = CmsGalleryItem::query();

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('label', 'like', '%'.$q.'%')
                    ->orWhere('image_url', 'like', '%'.$q.'%');
            });
        }

        if ($published === '1' || $published === '0') {
            $query->where('published', $published === '1');
        }

        match ($sort) {
            'oldest' => $query->orderBy('id'),
            'sort_order' => $query->orderBy('sort_order')->orderByDesc('id'),
            default => $query->orderByDesc('id'),
        };

        $rows = $query->paginate(20)->withQueryString();

        $importedQuery = ProductMedia::query()
            ->installation()
            ->visible()
            ->with(['product:id,parent_sku,name,short_name', 'mediaAsset']);

        if ($q !== '') {
            $importedQuery->where(function ($builder) use ($q) {
                $builder->where('source_url', 'like', '%'.$q.'%')
                    ->orWhere('stored_url', 'like', '%'.$q.'%')
                    ->orWhereHas('product', function ($productQuery) use ($q) {
                        $productQuery->where('parent_sku', 'like', '%'.$q.'%')
                            ->orWhere('name', 'like', '%'.$q.'%')
                            ->orWhere('short_name', 'like', '%'.$q.'%');
                    });
            });
        }

        $imported = $importedQuery
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(function (ProductMedia $media, int $index) {
                $url = $media->urlFor('card') ?? $media->urlFor('thumb') ?? $media->source_url;
                $product = $media->product;
                $label = $product
                    ? trim((string) ($product->short_name ?: $product->name)).' ('.$product->parent_sku.')'
                    : 'Import media #'.$media->id;

                return [
                    'id' => 'import-'.$media->id,
                    'no' => $index + 1,
                    'label' => $label !== '' ? $label : 'Hasil pemasangan (import)',
                    'image_url' => $url ?: '',
                    'published' => true,
                    'sort_order' => $media->position,
                    'created_at' => optional($media->created_at)?->toIso8601String(),
                    'source' => 'import',
                    'readonly' => true,
                    'media_asset_id' => $media->media_asset_id,
                    'attach_url' => $media->media_asset_id
                        ? route('admin.media.attach', $media->media_asset_id)
                        : null,
                    'edit_href' => $product
                        ? route('admin.products.media.byProduct', $product)
                        : route('admin.media.library'),
                    'publish_url' => null,
                    'unpublish_url' => null,
                ];
            })
            ->filter(fn (array $row) => filled($row['image_url']))
            ->values()
            ->all();

        $manualStart = count($imported);
        $manualRows = $rows->getCollection()->values()->map(function (CmsGalleryItem $item, int $index) use ($rows, $manualStart) {
            $no = $manualStart + (($rows->currentPage() - 1) * $rows->perPage()) + $index + 1;

            return [
                'id' => $item->id,
                'no' => $no,
                'label' => $item->label ?: '(tanpa label)',
                'image_url' => $item->image_url,
                'published' => $item->published,
                'sort_order' => $item->sort_order,
                'created_at' => optional($item->created_at)?->toIso8601String(),
                'source' => 'manual',
                'readonly' => false,
                'edit_href' => route('admin.gallery-items.edit', $item),
                'publish_url' => route('admin.gallery-items.publish', $item),
                'unpublish_url' => route('admin.gallery-items.unpublish', $item),
            ];
        })->all();

        return Inertia::render('Admin/InstallationGallery/Index', [
            'title' => 'Hasil Pemasangan Kami',
            'description' => 'Foto dari import produk (is_installation) + galeri manual untuk beranda dan /hasil-pemasangan.',
            'filters' => [
                'q' => $q,
                'sort' => in_array($sort, ['newest', 'oldest', 'sort_order'], true) ? $sort : 'newest',
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
            ],
            'sortOptions' => [
                ['value' => 'newest', 'label' => 'Terbaru'],
                ['value' => 'oldest', 'label' => 'Terlama'],
                ['value' => 'sort_order', 'label' => 'Urutan tampil'],
            ],
            'publishedOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => '1', 'label' => 'Published'],
                ['value' => '0', 'label' => 'Draft'],
            ],
            'createHref' => route('admin.gallery-items.create'),
            'createLabel' => 'Tambah galeri manual',
            'pickerUrl' => route('admin.media.picker'),
            'mediaStoreUrl' => url('/admin/kelola/produk/{productId}/media'),
            'products' => \App\Models\Product::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'parent_sku', 'name', 'short_name', 'product_model', 'design_variant'])
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'parent_sku' => $p->parent_sku,
                    'name' => $p->name,
                    'product_model' => $p->product_model,
                    'design_variant' => $p->design_variant,
                ])->values()->all(),
            'pageMeta' => InstallationPageSettings::pageMeta(),
            'metaUrl' => route('admin.hasil-pemasangan.meta.update'),
            'metaHint' => 'Meta halaman /hasil-pemasangan',
            'previewUrl' => route('installation.index'),
            'importedRows' => $imported,
            'rows' => $manualRows,
            'pagination' => InertiaAdmin::pagination($rows),
        ]);
    }

    public function updateMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:320'],
            'published' => ['boolean'],
        ]);
        $validated['published'] = $validated['published'] ?? false;

        InstallationPageSettings::updatePageMeta($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.hasil_pemasangan_meta_updated',
            'cms_page',
            InstallationPageSettings::pageId(),
            ['heading' => $validated['heading']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.hasil-pemasangan.index')
            ->with('success', 'Meta halaman Hasil Pemasangan disimpan.');
    }
}