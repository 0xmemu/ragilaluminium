<?php

namespace App\Services;

use App\Models\PerformanceMetric;
use App\Models\Product;
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

    protected function increment(int $productId, string $metricName): void
    {
        if ($productId <= 0) {
            return;
        }

        $today = now()->toDateString();

        $metric = PerformanceMetric::query()
            ->where('metric_date', $today)
            ->where('metric_name', $metricName)
            ->where('context->product_id', $productId)
            ->first();

        if ($metric) {
            $metric->increment('metric_value');

            return;
        }

        PerformanceMetric::query()->create([
            'metric_date' => $today,
            'metric_name' => $metricName,
            'metric_value' => 1,
            'context' => ['product_id' => $productId],
            'created_at' => now(),
        ]);
    }
}
