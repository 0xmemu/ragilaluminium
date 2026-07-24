<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\DownloadProductMedia;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Services\MediaDerivativeService;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProductMediaController extends Controller
{
    public function index(Request $request): Response
    {
        $media = ProductMedia::with(['product', 'productVariant'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('visibility'), fn ($q) => $q->where('visibility', $request->visibility))
            ->latest()
            ->paginate(24)
            ->withQueryString();

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Media',
            'description' => 'Status unduh & kelola foto produk. Bagian dari menu Produk.',
            'createHref' => null,
            'columns' => [
                ['key' => 'id', 'label' => 'ID'],
                ['key' => 'product', 'label' => 'Produk', 'hrefKey' => 'product_href'],
                ['key' => 'variant', 'label' => 'Varian'],
                ['key' => 'position', 'label' => 'Posisi'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'visibility', 'label' => 'Visibilitas'],
                ['key' => 'is_main', 'label' => 'Utama'],
            ],
            'rows' => $media->getCollection()->map(function (ProductMedia $m) {
                $actions = [];
                if ($m->product) {
                    $actions[] = [
                        'label' => 'Kelola',
                        'method' => 'get',
                        'href' => route('admin.products.media.byProduct', $m->product),
                    ];
                }
                $actions[] = [
                    'label' => 'Unduh ulang',
                    'method' => 'post',
                    'url' => route('admin.media.redownload', $m),
                ];
                if (! $m->is_main_image && $m->visibility !== 'archived') {
                    $actions[] = [
                        'label' => 'Jadikan utama',
                        'method' => 'post',
                        'url' => route('admin.media.set-main', $m),
                    ];
                }
                if ($m->status === 'failed') {
                    $actions[] = [
                        'label' => 'Hapus',
                        'method' => 'delete',
                        'url' => route('admin.media.destroy', $m),
                        'confirm' => 'Hapus media gagal #'.$m->id.' secara permanen?',
                    ];
                } elseif ($m->visibility !== 'archived') {
                    $actions[] = [
                        'label' => 'Arsipkan',
                        'method' => 'post',
                        'url' => route('admin.media.archive', $m),
                        'confirm' => 'Arsipkan media #'.$m->id.'?',
                    ];
                }

                return [
                    'id' => $m->id,
                    'product' => $m->product?->parent_sku ?? '-',
                    'product_href' => $m->product ? route('admin.products.media.byProduct', $m->product) : '',
                    'variant' => $m->productVariant
                        ? $this->variantLabel($m->productVariant)
                        : 'Semua (produk)',
                    'position' => $m->position,
                    'status' => $m->status,
                    'error_reason' => $m->error_reason,
                    'visibility' => $m->visibility,
                    'is_main' => $m->is_main_image ? 'ya' : 'tidak',
                    'actions' => $actions,
                ];
            })->all(),
            'pagination' => InertiaAdmin::pagination($media),
        ]);
    }

    public function byProduct(Request $request, Product $product): Response
    {
        $product->load(['variants' => fn ($q) => $q->orderBy('id'), 'media.productVariant']);

        $filterVariant = $request->query('variant');
        $filterVariantId = is_numeric($filterVariant) ? (int) $filterVariant : null;

        $mediaQuery = $product->media->sortBy('position')->values();
        if ($filterVariantId) {
            $mediaQuery = $mediaQuery->where('product_variant_id', $filterVariantId)->values();
        } elseif ($filterVariant === 'shared') {
            $mediaQuery = $mediaQuery->whereNull('product_variant_id')->values();
        }

        return Inertia::render('Admin/Products/Media', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'parent_sku' => $product->parent_sku,
                'show_href' => route('admin.products.show', $product),
                'variants_href' => route('admin.products.variants.index', $product),
            ],
            'variants' => $product->variants->map(fn (ProductVariant $variant) => [
                'id' => $variant->id,
                'label' => $this->variantLabel($variant),
                'variant_sku' => $variant->variant_sku,
                'status' => $variant->status,
            ])->values()->all(),
            'filters' => [
                'variant' => $filterVariantId
                    ? (string) $filterVariantId
                    : ($filterVariant === 'shared' ? 'shared' : ''),
            ],
            'storeUrl' => route('admin.products.media.store', $product),
            'indexUrl' => route('admin.products.media.byProduct', $product),
            'rows' => $mediaQuery->map(fn (ProductMedia $m) => [
                'id' => $m->id,
                'position' => $m->position,
                'status' => $m->status,
                'error_reason' => $m->error_reason,
                'visibility' => $m->visibility,
                'is_main_image' => (bool) $m->is_main_image,
                'show_in_catalog' => (bool) $m->show_in_catalog,
                'is_installation' => (bool) $m->is_installation,
                'product_variant_id' => $m->product_variant_id,
                'variant_label' => $m->productVariant
                    ? $this->variantLabel($m->productVariant)
                    : 'Semua (produk)',
                'thumb_url' => $m->urlFor('thumb') ?? $m->stored_url,
                'update_url' => route('admin.media.update', $m),
                'set_main_url' => route('admin.media.set-main', $m),
                'archive_url' => route('admin.media.archive', $m),
                'redownload_url' => route('admin.media.redownload', $m),
                'destroy_url' => $m->status === 'failed'
                    ? route('admin.media.destroy', $m)
                    : null,
            ])->values()->all(),
        ]);
    }

    public function store(Request $request, Product $product): RedirectResponse
    {
        if ($request->exists('product_variant_id') && ! $request->filled('product_variant_id')) {
            $request->merge(['product_variant_id' => null]);
        }

        $validated = $request->validate([
            'source_url' => ['nullable', 'url'],
            'position' => ['required', 'integer', 'min:1', 'max:109'],
            'is_main_image' => ['boolean'],
            'show_in_catalog' => ['boolean'],
            'is_installation' => ['boolean'],
            'visibility' => ['required', 'in:visible,archived,hidden'],
            'upload' => ['nullable', 'file', 'image', 'max:10240'],
            'product_variant_id' => [
                'nullable',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $product->id),
            ],
        ]);

        $data = [
            'product_id' => $product->id,
            'product_variant_id' => $validated['product_variant_id'] ?? null,
            'position' => $validated['position'],
            'is_main_image' => $validated['is_main_image'] ?? false,
            'show_in_catalog' => $validated['show_in_catalog'] ?? true,
            'is_installation' => $validated['is_installation'] ?? false,
            'visibility' => $validated['visibility'],
            'source_url' => $validated['source_url'] ?? null,
            'status' => 'pending',
            'created_by_user_id' => $request->user()->id,
        ];

        if ($request->hasFile('upload')) {
            $file = $request->file('upload');
            $path = $file->store("products/{$product->id}", 'media');
            $data['stored_path'] = $path;
            $data['stored_url'] = Storage::disk(config('media.disk', 'media'))->url($path);
            $data['mime_type'] = $file->getMimeType();
            $data['size_bytes'] = $file->getSize();
            $data['status'] = 'downloaded';

            try {
                $derivatives = app(MediaDerivativeService::class);
                $built = $derivatives->regenerateFromStored($path, (int) $product->id);
                $data['derivatives'] = $built;
                $promoted = $derivatives->promoteMasterAndDiscardOriginal($path, $built);
                if ($promoted !== null) {
                    $data = array_merge($data, $promoted);
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        if (! empty($data['is_main_image'])) {
            ProductMedia::where('product_id', $product->id)->update(['is_main_image' => false]);
        }

        $media = ProductMedia::create($data);

        if ($data['status'] === 'pending' && ! empty($data['source_url'])) {
            DownloadProductMedia::dispatch($media->id);
        }

        $params = ['product' => $product];
        if (! empty($validated['product_variant_id'])) {
            $params['variant'] = $validated['product_variant_id'];
        }

        return redirect()
            ->route('admin.products.media.byProduct', $params)
            ->with('success', 'Media ditambahkan.');
    }

    public function update(Request $request, ProductMedia $media): RedirectResponse
    {
        if ($request->exists('product_variant_id') && ! $request->filled('product_variant_id')) {
            $request->merge(['product_variant_id' => null]);
        }

        $validated = $request->validate([
            'position' => ['sometimes', 'integer', 'min:1', 'max:109'],
            'visibility' => ['sometimes', 'in:visible,archived,hidden'],
            'show_in_catalog' => ['sometimes', 'boolean'],
            'is_installation' => ['sometimes', 'boolean'],
            'product_variant_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $media->product_id),
            ],
        ]);

        $media->update($validated);

        return redirect()->back()->with('success', 'Media diperbarui.');
    }

    public function setMain(ProductMedia $media): RedirectResponse
    {
        ProductMedia::where('product_id', $media->product_id)->update(['is_main_image' => false]);
        $media->update(['is_main_image' => true]);

        return redirect()->back()->with('success', 'Gambar utama diatur.');
    }

    public function archive(ProductMedia $media): RedirectResponse
    {
        $media->update(['visibility' => 'archived']);

        return redirect()->back()->with('success', 'Media diarsipkan.');
    }

    public function redownload(ProductMedia $media): RedirectResponse
    {
        $media->update(['status' => 'pending', 'error_reason' => null]);
        DownloadProductMedia::dispatch($media->id);

        return redirect()->back()->with('success', 'Download media dijadwalkan ulang.');
    }

    public function destroy(ProductMedia $media): RedirectResponse
    {
        if ($media->status !== 'failed') {
            return redirect()->back()->with('error', 'Hanya media berstatus gagal yang dapat dihapus permanen. Arsipkan media lain.');
        }

        $paths = array_filter([
            $media->stored_path,
            ...collect($media->derivatives ?? [])->pluck('path')->filter()->all(),
        ]);

        $disk = \Illuminate\Support\Facades\Storage::disk(config('media.disk', 'media'));
        foreach ($paths as $path) {
            try {
                if (is_string($path) && $path !== '' && $disk->exists($path)) {
                    $disk->delete($path);
                }
            } catch (\Throwable) {
                // Ignore storage cleanup errors; DB row still removed.
            }
        }

        $media->delete();

        return redirect()->back()->with('success', 'Media gagal dihapus.');
    }

    protected function variantLabel(ProductVariant $variant): string
    {
        $parts = array_values(array_filter([
            $variant->variation_1_option,
            $variant->variation_2_option,
        ], fn ($v) => filled($v)));

        if ($parts === []) {
            return $variant->variant_sku;
        }

        return implode(' / ', $parts).' · '.$variant->variant_sku;
    }
}
