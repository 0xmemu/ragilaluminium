<?php

namespace App\Services;

use App\Models\PerformanceMetric;
use App\Models\Product;
use Illuminate\Database\UniqueConstraintViolationException;
use Carbon\Carbon;

/**
 * Agregat view/click produk storefront via performance_metrics (context.product_id).
 */
class ProductEngagementService
{
    public const METRIC_VIEWS = 'product_views';

    public const METRIC_CLICKS = 'product_clicks';

    public function __construct(protected StorePerformanceService $performance)
    {
    }

    public function trackView(int $productId): void
    {
        $this->increment($productId, self::METRIC_VIEWS);
    }

    public function trackClick(int $productId): void
    {
        $this->increment($productId, self::METRIC_CLICKS);
    }

    /**
     * @return array{period: string, period_label: string, items: list<array{
     *   id: int,
     *   parent_sku: string,
     *   name: string,
     *   image: string|null,
     *   views: int,
     *   clicks: int,
     *   total: int,
     *   href: string
     * }>}
     */
    public function topProducts(string $period = 'last_7', int $limit = 8): array
    {
        $range = $this->performance->resolveRange($period);
        $from = $range['from']->toDateString();
        $to = $range['to']->toDateString();

        $rows = PerformanceMetric::query()
            ->whereIn('metric_name', [self::METRIC_VIEWS, self::METRIC_CLICKS])
            ->whereDate('metric_date', '>=', $from)
            ->whereDate('metric_date', '<=', $to)
            ->get();

        /** @var array<int, array{views: float, clicks: float}> $totals */
        $totals = [];

        foreach ($rows as $row) {
            $productId = (int) data_get($row->context, 'product_id', 0);
            if ($productId <= 0) {
                continue;
            }

            if (! isset($totals[$productId])) {
                $totals[$productId] = ['views' => 0.0, 'clicks' => 0.0];
            }

            $value = (float) $row->metric_value;
            if ($row->metric_name === self::METRIC_VIEWS) {
                $totals[$productId]['views'] += $value;
            } else {
                $totals[$productId]['clicks'] += $value;
            }
        }

        if ($totals === []) {
            return [
                'period' => $period,
                'period_label' => $range['label'],
                'items' => [],
            ];
        }

        uasort($totals, function (array $a, array $b): int {
            $totalA = $a['views'] + $a['clicks'];
            $totalB = $b['views'] + $b['clicks'];
            if ($totalA !== $totalB) {
                return $totalB <=> $totalA;
            }
            if ($a['views'] !== $b['views']) {
                return $b['views'] <=> $a['views'];
            }

            return $b['clicks'] <=> $a['clicks'];
        });

        $productIds = array_slice(array_keys($totals), 0, $limit);
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->with('mainImage')
            ->get()
            ->keyBy('id');

        $items = collect($productIds)
            ->map(function (int $productId) use ($totals, $products): ?array {
                $product = $products->get($productId);
                if (! $product) {
                    return null;
                }

                $views = (int) round($totals[$productId]['views']);
                $clicks = (int) round($totals[$productId]['clicks']);

                return [
                    'id' => $product->id,
                    'parent_sku' => $product->parent_sku,
                    'name' => $product->name,
                    'image' => $product->mainImage?->urlFor('thumb') ?? $product->mainImage?->urlFor('card'),
                    'views' => $views,
                    'clicks' => $clicks,
                    'total' => $views + $clicks,
                    'href' => route('admin.products.show', $product),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return [
            'period' => $period,
            'period_label' => $range['label'],
            'items' => $items,
        ];
    }

    /**
     * Views & clicks per produk untuk periode [from, to] (inklusif), dihitung
     * dari performance_metrics. Dipakai halaman Paling Banyak Dipesan untuk
     * membandingkan performa SEBELUM vs SESUDAH produk masuk carousel.
     *
     * @param  list<int>  $productIds
     * @return array<int, array{views: int, clicks: int}>
     */
    public function viewsClicksFor(array $productIds, Carbon $from, Carbon $to): array
    {
        $wanted = array_fill_keys(array_map('intval', $productIds), true);
        $out = [];
        foreach ($wanted as $id => $_) {
            $out[$id] = ['views' => 0, 'clicks' => 0];
        }

        if ($wanted === [] || $from->greaterThan($to)) {
            return $out;
        }

        // Filter tanggal di SQL dulu supaya tidak memuat riwayat penuh.
        $rows = PerformanceMetric::query()
            ->whereIn('metric_name', [self::METRIC_VIEWS, self::METRIC_CLICKS])
            ->whereDate('metric_date', '>=', $from->toDateString())
            ->whereDate('metric_date', '<=', $to->toDateString())
            ->get(['metric_name', 'metric_value', 'context']);

        foreach ($rows as $row) {
            $productId = (int) data_get($row->context, 'product_id', 0);
            if (! isset($wanted[$productId])) {
                continue;
            }

            $value = (int) round((float) $row->metric_value);
            if ($row->metric_name === self::METRIC_VIEWS) {
                $out[$productId]['views'] += $value;
            } else {
                $out[$productId]['clicks'] += $value;
            }
        }

        return $out;
    }

    protected function increment(int $productId, string $metricName): void
    {
        if ($productId <= 0) {
            return;
        }

        $today = now()->toDateString();
        $context = ['product_id' => $productId];
        $hash = PerformanceMetric::hashContext($context);

        // whereDate utk konsisten (sqlite menyimpan datetime; mysql menyimpan date).
        $metric = PerformanceMetric::query()
            ->whereDate('metric_date', $today)
            ->where('metric_name', $metricName)
            ->where('context_hash', $hash)
            ->first();

        if ($metric) {
            $metric->increment('metric_value');

            return;
        }

        try {
            PerformanceMetric::query()->create([
                'metric_date' => $today,
                'metric_name' => $metricName,
                'metric_value' => 1,
                'context' => $context,
                'context_hash' => $hash,
                'created_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            // Race: baris dibuat worker lain - cukup increment baris tsb.
            PerformanceMetric::query()
                ->whereDate('metric_date', $today)
                ->where('metric_name', $metricName)
                ->where('context_hash', $hash)
                ->first()?->increment('metric_value');
        }
    }
}
