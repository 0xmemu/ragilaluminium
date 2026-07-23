<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StorePerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_store_performance_page_renders_report(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance', ['period' => 'today']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Analytics/StorePerformance')
                ->has('report.sections', 3)
                ->has('report.charts', 3)
                ->where('filters.period', 'today'));
    }

    public function test_revenue_excludes_pending_and_cancelled_orders(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-PERF-1',
            'name' => 'Jendela Perf',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $paid = Order::create([
            'order_number' => 'RA-PERF-PAID',
            'customer_name' => 'Budi',
            'customer_phone' => '081111111111',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        OrderItem::create([
            'order_id' => $paid->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-PERF-1',
            'name' => 'Jendela Perf',
            'unit_price' => 1000000,
            'quantity' => 2,
            'line_subtotal' => 2000000,
            'line_discount' => 0,
            'line_total' => 2000000,
        ]);
        // Fix line totals vs order total for metrics (units from items, revenue from order).
        $paid->update(['subtotal_amount' => 2000000, 'total_amount' => 2000000]);

        Order::create([
            'order_number' => 'RA-PERF-PEND',
            'customer_name' => 'Ani',
            'customer_phone' => '082222222222',
            'shipping_address_line1' => 'Jl B',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 500000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        Order::create([
            'order_number' => 'RA-PERF-CAN',
            'customer_name' => 'Cici',
            'customer_phone' => '083333333333',
            'shipping_address_line1' => 'Jl C',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jabar',
            'shipping_postal_code' => '40115',
            'shipping_country' => 'Indonesia',
            'order_status' => 'cancelled',
            'payment_status' => 'pending',
            'shipping_status' => 'cancelled',
            'subtotal_amount' => 750000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 750000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        $service = app(StorePerformanceService::class);
        $metrics = $service->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertEquals(2000000.0, $metrics['revenue']);
        $this->assertEquals(3, $metrics['orders']);
        $this->assertEquals(2, $metrics['units']);
        $this->assertEquals(1, $metrics['models_sold']);
    }

    public function test_csv_export_downloads(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance.export', ['period' => 'last_7']))
            ->assertOk()
            ->assertHeader('content-disposition');
    }

    public function test_storefront_visit_increments_unique_visitors(): void
    {
        $this->get('/')->assertOk();

        $this->assertDatabaseHas('performance_metrics', [
            'metric_name' => 'storefront_unique_visitors',
            'metric_value' => 1,
        ]);
        $this->assertDatabaseHas('performance_metrics', [
            'metric_name' => 'storefront_page_views',
        ]);
    }
}
