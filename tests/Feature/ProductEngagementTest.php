<?php

namespace Tests\Feature;

use App\Models\PerformanceMetric;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\ProductEngagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductEngagementTest extends TestCase
{
    use RefreshDatabase;

    private function createVisibleProduct(string $sku = 'WIN-ENG-1'): Product
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela Engagement',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }

    public function test_product_detail_tracks_view_metric(): void
    {
        $product = $this->createVisibleProduct();

        $this->get(route('product.show', $product->parent_sku))
            ->assertOk();

        $this->assertDatabaseHas('performance_metrics', [
            'metric_name' => ProductEngagementService::METRIC_VIEWS,
        ]);

        $metric = PerformanceMetric::query()
            ->where('metric_name', ProductEngagementService::METRIC_VIEWS)
            ->where('context->product_id', $product->id)
            ->first();

        $this->assertNotNull($metric);
        $this->assertEquals(1, (int) $metric->metric_value);
    }

    public function test_product_engage_endpoint_tracks_click(): void
    {
        $product = $this->createVisibleProduct('WIN-ENG-2');

        $this->postJson(route('product.engage', $product), ['action' => 'click'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertDatabaseHas('performance_metrics', [
            'metric_name' => ProductEngagementService::METRIC_CLICKS,
        ]);

        $metric = PerformanceMetric::query()
            ->where('metric_name', ProductEngagementService::METRIC_CLICKS)
            ->where('context->product_id', $product->id)
            ->first();

        $this->assertNotNull($metric);
        $this->assertEquals(1, (int) $metric->metric_value);
    }

    public function test_admin_dashboard_includes_top_engaged_products(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->createVisibleProduct('WIN-ENG-3');

        $service = app(ProductEngagementService::class);
        $service->trackView($product->id);
        $service->trackClick($product->id);

        $this->actingAs($admin)
            ->get(route('admin.dashboard', ['performa_period' => 'last_7']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->has('topEngagedProducts.items', 1)
                ->where('topEngagedProducts.items.0.id', $product->id)
                ->where('topEngagedProducts.items.0.views', 1)
                ->where('topEngagedProducts.items.0.clicks', 1)
                ->where('topEngagedProducts.items.0.total', 2));
    }
}
