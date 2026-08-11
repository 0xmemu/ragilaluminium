<?php

namespace Tests\Feature;

use App\Models\PerformanceMetric;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\ProductEngagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Mengunci kontrak payload dashboard: `topEngagedProducts` yang dikirim
 * DashboardController dari ProductEngagementService::topProducts().
 *
 * Shape item ({id, parent_sku, name, image, views, clicks, total, href}),
 * urutan sort (total desc → views desc → clicks desc) dan batas limit
 * dikonsumsi langsung oleh Dashboard.tsx — perubahan apa pun harus disengaja.
 */
class ProductEngagementContractTest extends TestCase
{
    use RefreshDatabase;

    private function createVisibleProduct(string $sku): Product
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 1_000_000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }

    private function addMetric(int $productId, string $metricName, int $value, ?string $date = null): void
    {
        PerformanceMetric::create([
            'metric_date' => $date ?? now()->toDateString(),
            'metric_name' => $metricName,
            'metric_value' => $value,
            'context' => ['product_id' => $productId],
            'created_at' => now(),
        ]);
    }

    public function test_top_products_returns_contract_shape(): void
    {
        $product = $this->createVisibleProduct('WIN-ENG-CONTRACT-1');
        $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 10);
        $this->addMetric($product->id, ProductEngagementService::METRIC_CLICKS, 2);

        $result = app(ProductEngagementService::class)->topProducts('last_7');

        $this->assertSame(['period', 'period_label', 'items'], array_keys($result));
        $this->assertSame('last_7', $result['period']);
        $this->assertIsString($result['period_label']);
        $this->assertCount(1, $result['items']);

        $item = $result['items'][0];
        $this->assertSame(
            ['id', 'parent_sku', 'name', 'image', 'views', 'clicks', 'total', 'href'],
            array_keys($item),
            'shape item harus persis kontrak Dashboard.tsx TopEngagedProduct'
        );
        $this->assertSame($product->id, $item['id']);
        $this->assertSame($product->parent_sku, $item['parent_sku']);
        $this->assertSame(10, $item['views']);
        $this->assertSame(2, $item['clicks']);
        $this->assertSame(12, $item['total']);
        $this->assertNull($item['image'], 'tanpa main image → null');
        $this->assertStringContainsString('/admin/products/', $item['href']);
    }

    public function test_top_products_sorts_by_total_then_views(): void
    {
        $a = $this->createVisibleProduct('WIN-ENG-SORT-A'); // 5 views + 1 click = 6
        $b = $this->createVisibleProduct('WIN-ENG-SORT-B'); // 3 views + 4 clicks = 7
        $c = $this->createVisibleProduct('WIN-ENG-SORT-C'); // 6 views + 1 click = 7 → unggul vs B karena views

        $this->addMetric($a->id, ProductEngagementService::METRIC_VIEWS, 5);
        $this->addMetric($a->id, ProductEngagementService::METRIC_CLICKS, 1);
        $this->addMetric($b->id, ProductEngagementService::METRIC_VIEWS, 3);
        $this->addMetric($b->id, ProductEngagementService::METRIC_CLICKS, 4);
        $this->addMetric($c->id, ProductEngagementService::METRIC_VIEWS, 6);
        $this->addMetric($c->id, ProductEngagementService::METRIC_CLICKS, 1);

        $items = app(ProductEngagementService::class)->topProducts('last_7', 8)['items'];

        $this->assertSame([$c->id, $b->id, $a->id], array_column($items, 'id'));
        $this->assertSame([7, 7, 6], array_column($items, 'total'));
        $this->assertSame([6, 3, 5], array_column($items, 'views'));
    }

    public function test_top_products_respects_limit(): void
    {
        foreach (['WIN-ENG-LIM-1', 'WIN-ENG-LIM-2', 'WIN-ENG-LIM-3'] as $sku) {
            $product = $this->createVisibleProduct($sku);
            $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 1);
        }

        $items = app(ProductEngagementService::class)->topProducts('last_7', 2)['items'];

        $this->assertCount(2, $items);
    }

    public function test_top_products_aggregates_metrics_across_days(): void
    {
        $product = $this->createVisibleProduct('WIN-ENG-MULTI');

        $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 4, now()->toDateString());
        $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 3, now()->subDay()->toDateString());
        $this->addMetric($product->id, ProductEngagementService::METRIC_CLICKS, 1, now()->subDays(2)->toDateString());

        $item = app(ProductEngagementService::class)->topProducts('last_7', 8)['items'][0];

        $this->assertSame(7, $item['views']);
        $this->assertSame(1, $item['clicks']);
        $this->assertSame(8, $item['total']);
    }

    public function test_top_products_returns_empty_items_without_data(): void
    {
        $result = app(ProductEngagementService::class)->topProducts('last_7');

        $this->assertSame('last_7', $result['period']);
        $this->assertSame([], $result['items']);
    }

    public function test_top_products_ignores_rows_without_product_context(): void
    {
        $product = $this->createVisibleProduct('WIN-ENG-CTX');
        $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 5);

        PerformanceMetric::create([
            'metric_date' => now()->toDateString(),
            'metric_name' => ProductEngagementService::METRIC_VIEWS,
            'metric_value' => 99,
            'context' => null, // bukan per-produk → harus dilewati
            'created_at' => now(),
        ]);

        $items = app(ProductEngagementService::class)->topProducts('last_7', 8)['items'];

        $this->assertCount(1, $items);
        $this->assertSame($product->id, $items[0]['id']);
        $this->assertSame(5, $items[0]['views']);
    }

    public function test_top_products_excludes_rows_outside_period(): void
    {
        $product = $this->createVisibleProduct('WIN-ENG-RANGE');
        $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 5, now()->toDateString());
        // Di luar jendela last_7 (10 hari lalu) → tidak boleh terhitung.
        $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, 50, now()->subDays(10)->toDateString());

        $item = app(ProductEngagementService::class)->topProducts('last_7', 8)['items'][0];

        $this->assertSame(5, $item['views']);
    }

    public function test_top_products_default_limit_is_8(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            $product = $this->createVisibleProduct('WIN-ENG-DEF-'.$i);
            $this->addMetric($product->id, ProductEngagementService::METRIC_VIEWS, $i);
        }

        $items = app(ProductEngagementService::class)->topProducts('last_7')['items'];

        $this->assertCount(8, $items);
    }
}
