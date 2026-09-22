<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PerformanceMetric;
use App\Models\Product;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StorePerformanceTask3Test extends TestCase
{
    use RefreshDatabase;
    use \Tests\Concerns\TanamEventPengakuan;

    private function makeProduct(int $sku): Product
    {
        return Product::create([
            'parent_sku' => 'T3-'.$sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function makeOrder(string $phone, string $amount, string $status, ?Carbon $createdAt = null): Order
    {
        $attrs = [
            'order_number' => 'T3-'.uniqid(),
            'customer_name' => 'Cust '.$phone,
            'customer_phone' => $phone,
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => $status === 'awaiting_confirmation' ? 'pending' : 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => (int) $amount,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => (int) $amount,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ];
        if ($createdAt) {
            $attrs['created_at'] = $createdAt;
            $attrs['updated_at'] = $createdAt;
        }
        $order = Order::create($attrs);
        if ($createdAt) {
            DB::table('orders')->where('id', $order->id)
                ->update(['created_at' => $createdAt, 'updated_at' => $createdAt]);
        }
        return $this->tanamEventPengakuan($order->fresh());
    }

    private function addItem(Order $order, Product $product, int $qty, int $price): void
    {
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => 0,
            'line_total' => $price * $qty,
        ]);
    }

    private function metric(string $name, int $productId, float $value, string $date): void
    {
        PerformanceMetric::create([
            'metric_date' => $date,
            'metric_name' => $name,
            'metric_value' => $value,
            'context' => ['product_id' => $productId],
            'created_at' => now(),
        ]);
    }

    private function breakdownsForToday(): array
    {
        return app(StorePerformanceService::class)->productPerformanceBreakdowns(
            Carbon::today()->startOfDay(),
            Carbon::today()->endOfDay(),
        );
    }

    public function test_top_products_existing_still_works(): void
    {
        $product = $this->makeProduct(1);
        $o = $this->makeOrder('081300000001', '100000', 'processing');
        $this->addItem($o, $product, 2, 100000);

        $service = app(StorePerformanceService::class);
        $top = $service->topProducts(Carbon::today()->startOfDay(), Carbon::today()->endOfDay());
        $this->assertNotEmpty($top);
        $this->assertArrayHasKey('parent_sku', $top[0]);
        $this->assertArrayHasKey('units', $top[0]);
    }

    public function test_most_viewed_ranks_by_views_only(): void
    {
        $p1 = $this->makeProduct(2);
        $p2 = $this->makeProduct(3);
        $today = now()->toDateString();
        $this->metric('product_views', $p1->id, 10, $today);
        $this->metric('product_views', $p2->id, 25, $today);
        $this->metric('product_clicks', $p1->id, 50, $today);

        $b = $this->breakdownsForToday();
        // most_viewed: p2 (25) > p1 (10) walaupun p1 punya banyak klik
        $this->assertSame('T3-3', $b['most_viewed'][0]['parent_sku']);
    }

    public function test_most_clicked_ranks_by_clicks_only(): void
    {
        $p1 = $this->makeProduct(4);
        $p2 = $this->makeProduct(5);
        $today = now()->toDateString();
        $this->metric('product_views', $p1->id, 100, $today);
        $this->metric('product_views', $p2->id, 1, $today);
        $this->metric('product_clicks', $p1->id, 8, $today);
        $this->metric('product_clicks', $p2->id, 30, $today);

        $b = $this->breakdownsForToday();
        // most_clicked: p2 (30) > p1 (8) walau p1 lebih banyak views
        $this->assertSame('T3-5', $b['most_clicked'][0]['parent_sku']);
    }

    public function test_most_viewed_and_clicked_use_period_metric_date(): void
    {
        $p1 = $this->makeProduct(6);
        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();
        $this->metric('product_views', $p1->id, 100, $today);
        $this->metric('product_views', $p1->id, 500, $yesterday); // luar periode

        $b = $this->breakdownsForToday();
        $this->assertCount(1, $b['most_viewed']);
        $this->assertSame(100, $b['most_viewed'][0]['views']);
    }

    public function test_best_sellers_ranks_by_quantity_and_revenue_scope(): void
    {
        $p1 = $this->makeProduct(7);
        $p2 = $this->makeProduct(8);
        $o1 = $this->makeOrder('081300000002', '100000', 'processing');
        $o2 = $this->makeOrder('081300000003', '100000', 'processing');
        $o3 = $this->makeOrder('081300000004', '100000', 'awaiting_confirmation'); // non-revenue
        $this->addItem($o1, $p1, 5, 100000);
        $this->addItem($o2, $p2, 3, 100000);
        $this->addItem($o3, $p1, 50, 100000); // awaiting_confirmation -> tidak dihitung

        $b = $this->breakdownsForToday();
        $this->assertSame('T3-7', $b['best_sellers'][0]['parent_sku']);
        $this->assertSame(5, $b['best_sellers'][0]['units']);
    }

    public function test_best_sellers_excludes_cancelled(): void
    {
        $p1 = $this->makeProduct(9);
        $oGood = $this->makeOrder('081300000005', '100000', 'processing');
        $oCancelled = $this->makeOrder('081300000006', '100000', 'cancelled');
        $this->addItem($oGood, $p1, 4, 100000);
        $this->addItem($oCancelled, $p1, 100, 100000);

        $b = $this->breakdownsForToday();
        $this->assertSame(4, $b['best_sellers'][0]['units'] ?? 0, 'cancelled tidak dihitung');
    }

    public function test_no_data_returns_empty_arrays(): void
    {
        $b = $this->breakdownsForToday();
        $this->assertSame([], $b['most_viewed']);
        $this->assertSame([], $b['most_clicked']);
        $this->assertSame([], $b['best_sellers']);
    }

    public function test_product_missing_does_not_error(): void
    {
        // metric utk product id yang TIDAK ada
        $this->metric('product_views', 999999, 10, now()->toDateString());
        $b = $this->breakdownsForToday();
        $this->assertSame([], $b['most_viewed']);
    }

    public function test_breakdowns_exposed_in_build_output(): void
    {
        $service = app(StorePerformanceService::class);
        $report = $service->build('today');
        $this->assertArrayHasKey('top_products', $report);
        $this->assertArrayHasKey('product_breakdowns', $report);
        $this->assertArrayHasKey('most_viewed', $report['product_breakdowns']);
        $this->assertArrayHasKey('most_clicked', $report['product_breakdowns']);
        $this->assertArrayHasKey('best_sellers', $report['product_breakdowns']);
    }
}