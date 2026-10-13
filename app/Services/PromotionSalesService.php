<?php

namespace App\Services;

use App\Models\OrderItem;
use App\Models\PerformanceMetric;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Support\CatalogLabels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Hasil penjualan kampanye promo (Promo & Flash Sale) untuk halaman detail.
 *
 * Kontrak (disepakati 2026-09-15, disederhanakan 2026-09-16):
 * - Cakupan produk = target kampanye tersimpan (resolveProductIds), sumber yang
 *   sama dengan kolom "Produk" di daftar promo.
 * - Penjualan dihitung HANYA dari order_items pada periode kampanye
 *   (starts_at..ends_at, jatuh ke created_at..sekarang bila periode belum
 *   diisi). Tidak ada rentang "semua waktu": halaman detail kampanye khusus
 *   menunjukkan efektivitas kampanye itu sendiri, bukan performa produk di
 *   luar promo.
 * - Hanya pesanan dalam scope omzet (StorePerformanceService::REVENUE_STATUSES)
 *   yang dihitung; pesanan menunggu konfirmasi dan dibatalkan tidak dihitung
 *   karena belum menjadi penjualan.
 * - Nilai uang memakai snapshot baris pesanan (line_total, line_discount),
 *   bukan hitungan ulang, supaya konsisten dengan modul Performa Toko.
 */
final class PromotionSalesService
{
    public function __construct(protected CampaignService $campaigns) {}

    /**
     * @return array{
     *   window: array{from: Carbon|null, to: Carbon|null, label: string},
     *   totals: array{products: int, variants: int, qty: int, orders: int, revenue: float, discount: float, sold_products: int, unsold_products: int},
     *   rows: list<array<string, mixed>>
     * }
     */
    public function report(Promotion $promotion): array
    {
        $productIds = $this->coveredProductIds($promotion);
        $window = $this->window($promotion);

        $inWindow = $this->aggregate($productIds, $window["from"], $window["to"]);
        $engagement = $this->engagement($productIds, $window["from"], $window["to"]);

        $products = $productIds === []
            ? collect()
            : Product::query()
                ->whereIn("id", $productIds)
                ->get(["id", "parent_sku", "name", "product_model", "design_variant", "status"])
                ->keyBy("id");

        $rows = collect($productIds)
            ->map(function (int $id) use ($products, $inWindow, $engagement) {
                $product = $products->get($id);
                $now = $inWindow->get($id);
                $engage = $engagement->get($id, ["views" => 0.0, "clicks" => 0.0]);

                return [
                    "id" => $id,
                    "name" => $product?->name ?? "#".$id,
                    "parent_sku" => $product?->parent_sku,
                    "model" => $product ? CatalogLabels::model($product->product_model) : null,
                    "sub_model" => $product ? CatalogLabels::design($product->design_variant) : null,
                    "product_status" => $product?->status,
                    "qty" => (int) ($now?->qty ?? 0),
                    // Keterlibatan storefront (dilihat/diklik) pada periode yang
                    // sama dengan penjualan, supaya bisa dibandingkan langsung.
                    "views" => (int) round($engage["views"]),
                    "clicks" => (int) round($engage["clicks"]),
                    "orders" => (int) ($now?->orders ?? 0),
                    "revenue" => round((float) ($now?->revenue ?? 0), 2),
                    "discount" => round((float) ($now?->discount ?? 0), 2),
                    "last_sold_at" => $now?->last_sold_at,
                ];
            })
            ->sortBy([
                ["qty", "desc"],
                ["name", "asc"],
            ])
            ->values()
            ->all();

        $qty = (int) collect($rows)->sum("qty");
        $revenue = round((float) collect($rows)->sum("revenue"), 2);
        $discount = round((float) collect($rows)->sum("discount"), 2);
        $soldProducts = collect($rows)->where("qty", ">", 0)->count();

        $variants = $productIds === []
            ? 0
            : ProductVariant::query()
                ->whereIn("product_id", $productIds)
                ->where("status", "active")
                ->count();

        return [
            "window" => $window,
            "totals" => [
                "products" => count($productIds),
                "variants" => (int) $variants,
                "qty" => $qty,
                "orders" => (int) collect($rows)->sum("orders"),
                "revenue" => $revenue,
                "discount" => $discount,
                "sold_products" => $soldProducts,
                "unsold_products" => count($productIds) - $soldProducts,
            ],
            "rows" => $rows,
        ];
    }

    /**
     * @return list<int>
     */
    private function coveredProductIds(Promotion $promotion): array
    {
        $targets = collect($promotion->items)->map(fn (PromotionItem $item) => [
            "target_type" => $item->target_type,
            "target_id" => $item->target_id,
            "excluded" => (bool) $item->excluded,
        ]);

        return $this->campaigns->resolveProductIds($targets)->values()->all();
    }

    /**
     * Rentang penjualan yang dihitung: periode kampanye. Kampanye tanpa periode
     * dianggap berjalan sejak kampanye dibuat sampai sekarang; ends_at yang
     * belum lewat dibatasi hingga sekarang agar tidak menghitung masa depan.
     *
     * @return array{from: Carbon|null, to: Carbon|null, label: string}
     */
    private function window(Promotion $promotion): array
    {
        $from = $promotion->starts_at ?? $promotion->created_at;
        $to = $promotion->ends_at;

        if ($to === null || $to->isFuture()) {
            $to = now();
        }

        if ($from !== null && $to !== null && $to->lt($from)) {
            $to = $from;
        }

        return ["from" => $from, "to" => $to, "label" => "Periode kampanye"];
    }

    /**
     * Keterlibatan storefront per produk: berapa kali dilihat dan diklik pada
     * periode kampanye. Sumbernya performance_metrics (metric_name product_views
     * dan product_clicks, produk ditandai di context.product_id), sama seperti
     * modul Performa Toko supaya definisinya tidak bercabang.
     *
     * @param  list<int>  $productIds
     * @return Collection<int, array{views: float, clicks: float}>
     */
    private function engagement(array $productIds, ?Carbon $from, ?Carbon $to): Collection
    {
        if ($productIds === []) {
            return collect();
        }

        $wanted = array_flip($productIds);

        return PerformanceMetric::query()
            ->whereIn("metric_name", [ProductEngagementService::METRIC_VIEWS, ProductEngagementService::METRIC_CLICKS])
            ->when($from !== null, fn ($query) => $query->whereDate("metric_date", ">=", $from->toDateString()))
            ->when($to !== null, fn ($query) => $query->whereDate("metric_date", "<=", $to->toDateString()))
            ->get(["metric_name", "metric_value", "context"])
            ->reduce(function (Collection $carry, PerformanceMetric $row) use ($wanted): Collection {
                $productId = (int) data_get($row->context, "product_id", 0);
                if (! isset($wanted[$productId])) {
                    return $carry;
                }

                $current = $carry->get($productId, ["views" => 0.0, "clicks" => 0.0]);
                $key = $row->metric_name === ProductEngagementService::METRIC_VIEWS ? "views" : "clicks";
                $current[$key] += (float) $row->metric_value;
                $carry->put($productId, $current);

                return $carry;
            }, collect());
    }

    /**
     * @param  list<int>  $productIds
     * @return Collection<int|string, object>
     */
    private function aggregate(array $productIds, ?Carbon $from, ?Carbon $to): Collection
    {
        if ($productIds === []) {
            return collect();
        }

        return OrderItem::query()
            ->join("orders", "orders.id", "=", "order_items.order_id")
            ->whereIn("order_items.product_id", $productIds)
            ->whereIn("orders.order_status", StorePerformanceService::REVENUE_STATUSES)
            ->when($from !== null, fn ($query) => $query->where("orders.created_at", ">=", $from))
            ->when($to !== null, fn ($query) => $query->where("orders.created_at", "<=", $to))
            ->groupBy("order_items.product_id")
            ->selectRaw("order_items.product_id as product_id")
            ->selectRaw("SUM(order_items.quantity) as qty")
            ->selectRaw("COUNT(DISTINCT order_items.order_id) as orders")
            ->selectRaw("SUM(order_items.line_total) as revenue")
            ->selectRaw("SUM(order_items.line_discount) as discount")
            ->selectRaw("MAX(orders.created_at) as last_sold_at")
            ->get()
            ->keyBy("product_id");
    }
}
