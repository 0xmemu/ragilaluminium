<?php

namespace Tests\Feature;

use App\Models\PerformanceMetric;
use App\Services\ProductEngagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Data integrity 1.1 — unique (metric_date, metric_name, context_hash).
 */
class PerformanceMetricUniqueTest extends TestCase
{
    use RefreshDatabase;

    public function test_engagement_increment_is_single_row_per_day_per_product(): void
    {
        $svc = app(ProductEngagementService::class);

        for ($i = 0; $i < 5; $i++) {
            $svc->trackClick(42);
        }

        $this->assertSame(1, PerformanceMetric::query()
            ->where('metric_name', 'product_clicks')
            ->where('context->product_id', 42)
            ->count());
        $this->assertSame(5.0, (float) PerformanceMetric::query()
            ->where('metric_name', 'product_clicks')
            ->where('context->product_id', 42)
            ->first()->metric_value);
    }

    public function test_duplicate_row_is_rejected_by_unique_index(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        PerformanceMetric::query()->create([
            'metric_date' => '2026-08-25',
            'metric_name' => 'product_views',
            'metric_value' => 1,
            'context' => ['product_id' => 7],
            'context_hash' => PerformanceMetric::hashContext(['product_id' => 7]),
            'created_at' => now(),
        ]);

        PerformanceMetric::query()->create([
            'metric_date' => '2026-08-25',
            'metric_name' => 'product_views',
            'metric_value' => 2,
            'context' => ['product_id' => 7],
            'context_hash' => PerformanceMetric::hashContext(['product_id' => 7]),
            'created_at' => now(),
        ]);
    }

    public function test_hash_context_is_canonical_key_order_independent(): void
    {
        $a = PerformanceMetric::hashContext(['product_id' => 5, 'extra' => 'x']);
        $b = PerformanceMetric::hashContext(['extra' => 'x', 'product_id' => 5]);

        $this->assertSame($a, $b);
        $this->assertSame(md5(''), PerformanceMetric::hashContext(null));
    }
}