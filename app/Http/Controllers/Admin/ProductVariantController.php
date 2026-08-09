<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\ShopeeStyleSku;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProductVariantController extends Controller
{
    public function index(Product $product): Response
    {
        $product->load(['variants' => fn ($q) => $q->withCount([
            'media as media_count' => fn ($mq) => $mq->where('visibility', '!=', 'archived'),
        ])]);

        return Inertia::render('Admin/Variants', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'parent_sku' => $product->parent_sku,
                'media_href' => route('admin.products.media.byProduct', $product),
            ],
            'variants' => $product->variants->map(fn (ProductVariant $variant) => [
                'id' => $variant->id,
                'variant_sku' => $variant->variant_sku,
                'variation_1_option' => $variant->variation_1_option,
                'variation_2_option' => $variant->variation_2_option,
                'price' => $variant->price,
                'stock' => $variant->stock,
                'status' => $variant->status,
                'media_count' => (int) ($variant->media_count ?? 0),
                'editUrl' => route('admin.variants.edit', $variant),
                'archiveUrl' => route('admin.variants.archive', $variant),
                'mediaUrl' => route('admin.products.media.byProduct', [
                    'product' => $product,
                    'variant' => $variant->id,
                ]),
            ])->values()->all(),
            'submitUrl' => route('admin.products.variants.store', $product),
        ]);
    }

    public function store(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'variation_1_name' => ['nullable', 'string'],
            'variation_1_option' => ['nullable', 'string'],
            'variation_2_name' => ['nullable', 'string'],
            'variation_2_option' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'weight_kg' => ['nullable', 'numeric'],
            'width_cm' => ['nullable', 'numeric'],
            'height_cm' => ['nullable', 'numeric'],
            'depth_cm' => ['nullable', 'numeric'],
            'status' => ['required', 'in:active,inactive,archived'],
        ]);
        $validated['product_id'] = $product->id;
        $validated['variant_sku'] = ShopeeStyleSku::nextVariantSku($product);
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        ProductVariant::create($validated);

        return redirect()->route('admin.products.variants.index', $product)
            ->with('success', 'Varian dibuat dengan SKU '.$validated['variant_sku'].'.');
    }

    public function bulkStore(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'wizard_step' => ['nullable', 'in:variants,media,review'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.variation_1_name' => ['nullable', 'string', 'max:255'],
            'variants.*.variation_1_option' => ['nullable', 'string', 'max:255'],
            'variants.*.variation_2_name' => ['nullable', 'string', 'max:255'],
            'variants.*.variation_2_option' => ['nullable', 'string', 'max:255'],
            'variants.*.price' => ['required', 'numeric', 'min:0'],
            'variants.*.stock' => ['required', 'integer', 'min:0'],
            'variants.*.weight_kg' => ['nullable', 'numeric', 'min:0'],
            'variants.*.width_cm' => ['nullable', 'numeric', 'min:0'],
            'variants.*.height_cm' => ['nullable', 'numeric', 'min:0'],
            'variants.*.depth_cm' => ['nullable', 'numeric', 'min:0'],
            'variants.*.status' => ['required', 'in:active,inactive,archived'],
        ]);

        DB::transaction(function () use ($validated, $product, $request): void {
            foreach ($validated['variants'] as $row) {
                ProductVariant::create([
                    ...$row,
                    'product_id' => $product->id,
                    'variant_sku' => ShopeeStyleSku::nextVariantSku($product),
                    'created_by_user_id' => $request->user()->id,
                    'updated_by_user_id' => $request->user()->id,
                ]);
            }
        });

        return redirect()->route('admin.products.edit', [
            'product' => $product,
            'step' => $validated['wizard_step'] ?? 'variants',
        ])->with('success', count($validated['variants']).' varian disimpan.');
    }

    public function edit(ProductVariant $variant): Response
    {
        $variant->load(['media' => fn ($q) => $q->orderBy('position')]);

        return Inertia::render('Admin/VariantEdit', [
            'variant' => [
                'id' => $variant->id,
                'product_id' => $variant->product_id,
                'variant_sku' => $variant->variant_sku,
                'variation_1_name' => $variant->variation_1_name,
                'variation_1_option' => $variant->variation_1_option,
                'variation_2_name' => $variant->variation_2_name,
                'variation_2_option' => $variant->variation_2_option,
                'price' => $variant->price,
                'stock' => $variant->stock,
                'weight_kg' => $variant->weight_kg,
                'width_cm' => $variant->width_cm,
                'height_cm' => $variant->height_cm,
                'depth_cm' => $variant->depth_cm,
                'status' => $variant->status,
            ],
            'media' => $variant->media->map(fn ($m) => [
                'id' => $m->id,
                'position' => $m->position,
                'visibility' => $m->visibility,
                'status' => $m->status,
                'is_main_image' => (bool) $m->is_main_image,
                'thumb_url' => $m->urlFor('thumb') ?? $m->stored_url,
                'update_url' => route('admin.media.update', $m),
                'set_main_url' => route('admin.media.set-main', $m),
                'archive_url' => route('admin.media.archive', $m),
            ])->values()->all(),
            'mediaStoreUrl' => route('admin.products.media.store', $variant->product_id),
            'mediaManageUrl' => route('admin.products.media.byProduct', [
                'product' => $variant->product_id,
                'variant' => $variant->id,
            ]),
            'submitUrl' => route('admin.variants.update', $variant),
            'backUrl' => route('admin.products.variants.index', $variant->product_id),
        ]);
    }

    public function update(Request $request, ProductVariant $variant): RedirectResponse
    {
        $validated = $request->validate([
            'variation_1_name' => ['nullable', 'string'],
            'variation_1_option' => ['nullable', 'string'],
            'variation_2_name' => ['nullable', 'string'],
            'variation_2_option' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'weight_kg' => ['nullable', 'numeric'],
            'width_cm' => ['nullable', 'numeric'],
            'height_cm' => ['nullable', 'numeric'],
            'depth_cm' => ['nullable', 'numeric'],
            'status' => ['required', 'in:active,inactive,archived'],
        ]);
        $validated['updated_by_user_id'] = $request->user()->id;
        $variant->update($validated);

        return redirect()->route('admin.products.variants.index', $variant->product_id)
            ->with('success', 'Varian diperbarui.');
    }

    public function archive(ProductVariant $variant): RedirectResponse
    {
        $variant->update(['status' => 'archived']);

        return redirect()->back()->with('success', 'Varian diarsipkan.');
    }
}
