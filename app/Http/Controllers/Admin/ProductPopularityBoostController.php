<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductPopularityBoost;
use App\Services\ProductPopularityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductPopularityBoostController extends Controller
{
    public function __construct(protected ProductPopularityService $popularity)
    {
    }

    public function index(): Response
    {
        $boosts = ProductPopularityBoost::query()
            ->with([
                'sourceProduct:id,parent_sku,name,product_model,status',
                'targetProduct:id,parent_sku,name,product_model,status,popularity_seed',
            ])
            ->latest('updated_at')
            ->get();

        foreach ($boosts as $boost) {
            $this->popularity->evaluateThreshold($boost);
        }

        $boosts->load([
            'sourceProduct:id,parent_sku,name,product_model,status',
            'targetProduct:id,parent_sku,name,product_model,status,popularity_seed',
        ]);

        $rows = $boosts->map(function (ProductPopularityBoost $boost): array {
            $sourceSold = $boost->sourceProduct
                ? (int) $boost->sourceProduct->validOrderItems()->sum('quantity')
                : 0;
            $targetSold = $boost->targetProduct
                ? (int) $boost->targetProduct->validOrderItems()->sum('quantity')
                : 0;

            return [
                'id' => $boost->id,
                'enabled' => (bool) $boost->enabled,
                'source' => $this->productOption($boost->sourceProduct),
                'target' => $this->productOption($boost->targetProduct),
                'seed_sold_count' => (int) $boost->seed_sold_count,
                'source_sold_count' => $sourceSold,
                'target_sold_count' => $targetSold,
                'effective_score' => (int) $boost->targetProduct?->popularity_seed + $targetSold,
                'notification_threshold' => $boost->notification_threshold,
                'threshold_notified_at' => optional($boost->threshold_notified_at)?->toIso8601String(),
                'disabled_at' => optional($boost->disabled_at)?->toIso8601String(),
                'disabled_reason' => $boost->disabled_reason,
                'updated_at' => optional($boost->updated_at)?->toIso8601String(),
                'disable_url' => route('admin.products.popularity-boosts.disable', $boost),
                'enable_url' => route('admin.products.popularity-boosts.enable', $boost),
            ];
        })->values()->all();

        $products = Product::query()
            ->where('status', 'active')
            ->orderBy('product_category')
            ->orderBy('product_model')
            ->orderBy('name')
            ->get(['id', 'parent_sku', 'name', 'product_category', 'product_model'])
            ->map(fn (Product $product) => $this->productOption($product))
            ->values()
            ->all();

        return Inertia::render('Admin/Products/PopularityBoosts', [
            'title' => 'Teruskan Popularitas',
            'description' => 'Pindahkan snapshot penjualan produk sumber menjadi seed popularitas produk target tanpa memindahkan riwayat order.',
            'boosts' => $rows,
            'products' => $products,
            'storeUrl' => route('admin.products.popularity-boosts.store'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'source_product_id' => ['required', 'integer', 'exists:products,id'],
            'target_product_id' => ['required', 'integer', 'exists:products,id', 'different:source_product_id'],
            'notification_threshold' => ['nullable', 'integer', 'min:1', 'max:1000000000'],
        ]);

        $this->popularity->enable(
            (int) $validated['source_product_id'],
            (int) $validated['target_product_id'],
            isset($validated['notification_threshold']) ? (int) $validated['notification_threshold'] : null,
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.products.popularity-boosts.index')
            ->with('success', 'Teruskan Popularitas diaktifkan. Snapshot penjualan sumber disimpan sebagai seed target.');
    }

    public function disable(Request $request, ProductPopularityBoost $boost): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $this->popularity->disable($boost, $validated['reason'], $request->user()?->id);

        return back()->with('success', 'Teruskan Popularitas dinonaktifkan. Seed target dikosongkan.');
    }

    public function enable(Request $request, ProductPopularityBoost $boost): RedirectResponse
    {
        $this->popularity->enable(
            (int) $boost->source_product_id,
            (int) $boost->target_product_id,
            $boost->notification_threshold,
            $request->user()?->id,
        );

        return back()->with('success', 'Teruskan Popularitas diaktifkan kembali dengan snapshot penjualan terbaru.');
    }

    private function productOption(?Product $product): ?array
    {
        if (! $product) {
            return null;
        }

        return [
            'id' => $product->id,
            'label' => trim(implode(' · ', array_filter([
                $product->parent_sku,
                $product->name,
                $product->product_category,
                $product->product_model,
            ]))),
        ];
    }
}
