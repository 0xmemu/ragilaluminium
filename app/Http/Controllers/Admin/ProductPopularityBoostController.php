<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use App\Models\ProductPopularityBoost;
use App\Services\ProductPopularityService;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProductPopularityBoostController extends Controller
{
    public function __construct(protected ProductPopularityService $popularity)
    {
    }

    public function index(Request $request): Response
    {
        // Search (SKU/nama produk sumber/target) + filter status, paginate 15.
        $search = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', 'all');

        $boosts = ProductPopularityBoost::query()
            ->with([
                'sourceProduct:id,parent_sku,name,product_model,status',
                'targetProduct:id,parent_sku,name,product_model,status,popularity_seed',
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $pattern = '%'.LikeSearch::pattern($search).'%';
                $query->where(function (Builder $inner) use ($pattern): void {
                    $inner->whereHas('sourceProduct', fn (Builder $p) => $p->where('parent_sku', 'like', $pattern)->orWhere('name', 'like', $pattern))
                        ->orWhereHas('targetProduct', fn (Builder $p) => $p->where('parent_sku', 'like', $pattern)->orWhere('name', 'like', $pattern));
                });
            })
            ->when($status === 'active', fn (Builder $query) => $query->where('enabled', true))
            ->when($status === 'disabled', fn (Builder $query) => $query->where('enabled', false))
            ->latest('updated_at')
            ->paginate(15)
            ->withQueryString();

        $rows = $boosts->getCollection()
            ->map(function (ProductPopularityBoost $boost): array {
                return $this->boostRow($boost);
            })
            ->values()
            ->all();

        $productOptions = Cache::remember('admin:popularity-boost:product-options', now()->addMinutes(5), function (): array {
            return Product::query()
                ->where('status', 'active')
                ->orderBy('product_category')
                ->orderBy('product_model')
                ->orderBy('name')
                ->get(['id', 'parent_sku', 'name', 'product_category', 'product_model', 'status'])
                ->map(fn (Product $product) => $this->productOption($product))
                ->values()
                ->all();
        });

        return Inertia::render('Admin/Products/PopularityBoosts', [
            'title' => 'Teruskan Popularitas',
            'description' => 'Daftar produk yang memakai Teruskan Popularitas. Dasarnya hanya dua: penjualan valid (seed ranking target) dan ulasan website terpublikasi (tampil di PDP target). Riwayat order tidak dipindahkan.',
            // "Teruskan Popularitas" punya entri sendiri di menu sidebar, jadi
            // tidak punya halaman induk; tombol Kembali ke daftar Produk justru
            // menunjuk halaman SAUDARA (sama-sama item sidebar), bukan atasan.
            // Polanya mengikuti halaman Kategori: item sidebar tanpa tombol
            // Kembali (koreksi owner 2026-10-03, sekelas kasus Media Library).
            'backUrl' => null,
            'filters' => [
                'q' => $search,
                'status' => $status,
            ],
            'summary' => [
                'total' => $boosts->total(),
                'active' => ProductPopularityBoost::query()->where('enabled', true)->count(),
            ],
            'boosts' => $rows,
            'products' => $productOptions,
            'pagination' => InertiaAdmin::pagination($boosts),
            'storeUrl' => route('admin.products.popularity-boosts.store'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'source_product_id' => ['required', 'integer', 'exists:products,id'],
            'target_product_id' => [
                'required', 'integer', 'exists:products,id',
                'different:source_product_id',
            ],
            'notification_threshold' => ['nullable', 'integer', 'min:1', 'max:1000000000'],
        ], [
            'source_product_id.required' => 'Pilih produk sumber.',
            'source_product_id.exists' => 'Produk sumber tidak ditemukan.',
            'target_product_id.required' => 'Pilih produk target.',
            'target_product_id.exists' => 'Produk target tidak ditemukan.',
            'target_product_id.different' => 'Produk sumber dan target harus berbeda.',
            'notification_threshold.integer' => 'Ambang harus berupa angka.',
            'notification_threshold.min' => 'Ambang minimal 1 unit.',
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

    public function update(Request $request, ProductPopularityBoost $boost): RedirectResponse
    {
        $validated = $request->validate([
            'source_product_id' => ['required', 'integer', 'exists:products,id'],
            'target_product_id' => ['required', 'integer', 'exists:products,id', 'different:source_product_id'],
            'notification_threshold' => ['nullable', 'integer', 'min:1', 'max:1000000000'],
        ], [
            'source_product_id.required' => 'Pilih produk sumber.',
            'source_product_id.exists' => 'Produk sumber tidak ditemukan.',
            'target_product_id.required' => 'Pilih produk target.',
            'target_product_id.exists' => 'Produk target tidak ditemukan.',
            'target_product_id.different' => 'Produk sumber dan target harus berbeda.',
            'notification_threshold.integer' => 'Ambang harus berupa angka.',
            'notification_threshold.min' => 'Ambang minimal 1 unit.',
        ]);

        $this->popularity->update(
            $boost,
            (int) $validated['source_product_id'],
            (int) $validated['target_product_id'],
            isset($validated['notification_threshold']) ? (int) $validated['notification_threshold'] : null,
            $request->user()?->id,
        );

        return back()->with('success', 'Teruskan Popularitas diperbarui.');
    }

    public function destroy(Request $request, ProductPopularityBoost $boost): RedirectResponse
    {
        $this->popularity->purge($boost, $request->user()?->id);

        return back()->with('success', 'Teruskan Popularitas dihapus permanen.');
    }

    public function enable(Request $request, ProductPopularityBoost $boost): RedirectResponse
    {
        try {
            $this->popularity->enable(
                (int) $boost->source_product_id,
                (int) $boost->target_product_id,
                $boost->notification_threshold,
                $request->user()?->id,
            );
        } catch (ValidationException $exception) {
            // Tombol "Aktifkan kembali" tidak terikat form, jadi error validasi
            // diteruskan sebagai flash error agar terlihat di banner global.
            return back()->with('error', $exception->validator->errors()->first());
        }

        return back()->with('success', 'Teruskan Popularitas diaktifkan kembali dengan snapshot penjualan terbaru.');
    }

    /**
     * Baris tabel padat: identitas pasangan + metrik ringkas + aksi.
     */
    private function boostRow(ProductPopularityBoost $boost): array
    {
        $sourceSold = $boost->sourceProduct
            ? (int) $boost->sourceProduct->validOrderItems()->sum('quantity')
            : 0;
        $targetSold = $boost->targetProduct
            ? (int) $boost->targetProduct->validOrderItems()->sum('quantity')
            : 0;

        $reviews = CmsTestimonial::query()
            ->published()
            ->website()
            ->where('product_id', $boost->source_product_id)
            ->selectRaw('COUNT(*) as review_count, AVG(rating) as avg_rating')
            ->first();

        return [
            'id' => $boost->id,
            'enabled' => (bool) $boost->enabled,
            'source' => $this->productOption($boost->sourceProduct),
            'target' => $this->productOption($boost->targetProduct),
            'seed_sold_count' => (int) $boost->seed_sold_count,
            'source_sold_count' => $sourceSold,
            'target_sold_count' => $targetSold,
            'effective_score' => (int) $boost->targetProduct?->popularity_seed + $targetSold,
            'source_review_count' => (int) ($reviews?->review_count ?? 0),
            'source_avg_rating' => $reviews?->avg_rating !== null ? round((float) $reviews->avg_rating, 1) : null,
            'notification_threshold' => $boost->notification_threshold,
            'threshold_notified_at' => optional($boost->threshold_notified_at)?->toIso8601String(),
            'disabled_at' => optional($boost->disabled_at)?->toIso8601String(),
            'disabled_reason' => $boost->disabled_reason,
            'updated_at' => optional($boost->updated_at)?->toIso8601String(),
            'disable_url' => route('admin.products.popularity-boosts.disable', $boost),
            'enable_url' => route('admin.products.popularity-boosts.enable', $boost),
            'delete_url' => route('admin.products.popularity-boosts.destroy', $boost),
            'edit_url' => route('admin.products.popularity-boosts.update', $boost),
        ];
    }

    private function productOption(?Product $product): ?array
    {
        if (! $product) {
            return null;
        }

        $name = trim((string) $product->name);
        $sku = trim((string) $product->parent_sku);

        return [
            'id' => $product->id,
            'status' => $product->status,
            // Label ringkas: nama produk dengan SKU di belakangnya.
            'label' => $sku !== '' ? $name.' ('.$sku.')' : $name,
        ];
    }
}
