<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\OrderReturnItem;
use App\Models\Product;
use App\Models\User;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorePerformanceTask1Test extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(int $sku): Product
    {
        return Product::create([
            'parent_sku' => 'TASK1-'.$sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function makeOrder(string $phone, string $amount, string $status, bool $cod = false, ?Carbon $createdAt = null): Order
    {
        $num = 'T1-'.uniqid();
        $attrs = [
            'order_number' => $num,
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
            'payment_method' => $cod ? 'cod' : 'transfer',
            'cod_flag' => $cod,
        ];

        if ($createdAt) {
            $attrs['created_at'] = $createdAt;
            $attrs['updated_at'] = $createdAt;
        }

        $order = Order::create($attrs);

        if ($createdAt) {
            // Raw DB update: Eloquent menimpa created_at pada save; forced here.
            \Illuminate\Support\Facades\DB::table('orders')
                ->where('id', $order->id)
                ->update(['created_at' => $createdAt, 'updated_at' => $createdAt]);
        }

        return $order->fresh();
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

    private function makeReturnCase(Order $order, string $status = 'completed', ?Carbon $createdAt = null, ?Carbon $completedAt = null, float $refund = 0, int $returnedQty = 1): OrderReturnCase
    {
        $attrs = [
            'order_id' => $order->id,
            'status' => $status,
            'reason' => 'rusak',
            'reason_detail' => null,
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'resolution_type' => $status === 'completed' ? 'refund' : null,
            'refund_amount' => $refund,
            'replacement_amount' => 0,
            'additional_shipping_amount' => 0,
        ];

        if ($createdAt) {
            $attrs['created_at'] = $createdAt;
            $attrs['updated_at'] = $createdAt;
        }

        $case = OrderReturnCase::create($attrs);

        if ($createdAt) {
            // Raw DB update: Eloquent menimpa timestamp; forced here.
            \Illuminate\Support\Facades\DB::table('order_return_cases')
                ->where('id', $case->id)
                ->update(['created_at' => $createdAt, 'updated_at' => $createdAt]);
        }
        if ($completedAt) {
            \Illuminate\Support\Facades\DB::table('order_return_cases')
                ->where('id', $case->id)
                ->update(['completed_at' => $completedAt]);
        }

        $orderItem = $order->items()->first();
        if ($orderItem) {
            OrderReturnItem::create([
                'return_case_id' => $case->id,
                'order_item_id' => $orderItem->id,
                'requested_quantity' => $returnedQty,
                'returned_quantity' => $returnedQty,
            ]);
        }

        return $case->fresh();
    }

    private function metricsForToday(): array
    {
        return app(StorePerformanceService::class)->metricsFor(
            Carbon::today()->startOfDay(),
            Carbon::today()->endOfDay(),
        );
    }

    public function test_aov_calculates_gross_over_orders(): void
    {
        $product = $this->makeProduct(1);
        $o1 = $this->makeOrder('081100000001', '100000', 'processing');
        $o2 = $this->makeOrder('081100000002', '300000', 'processing');
        $this->addItem($o1, $product, 1, 100000);
        $this->addItem($o2, $product, 1, 300000);

        $m = $this->metricsForToday();
        $this->assertSame(2, $m['orders']);
        $this->assertSame(200000.0, $m['aov']);
    }

    public function test_aov_zero_when_no_orders(): void
    {
        $m = $this->metricsForToday();
        $this->assertSame(0.0, $m['aov']);
    }

    public function test_returns_created_uses_created_at_in_period(): void
    {
        $product = $this->makeProduct(2);
        $o = $this->makeOrder('081100000003', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);

        $this->makeReturnCase($o, 'completed', now()->subDays(2), now()->subDays(2), 100000);
        $this->makeReturnCase($o, 'completed', today(), today(), 100000);

        $m = $this->metricsForToday();
        $this->assertSame(1, $m['returns_created'], 'hanya case dgn created_at hari ini');
    }

    public function test_returns_completed_uses_completed_at_in_period(): void
    {
        $product = $this->makeProduct(3);
        $o = $this->makeOrder('081100000004', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);

        $this->makeReturnCase($o, 'completed', now()->subDays(2), today(), 50000, 1);
        $this->makeReturnCase($o, 'completed', now()->subDays(2), now()->subDays(2), 50000, 1);

        $m = $this->metricsForToday();
        $this->assertSame(1, $m['returns_completed'], 'hanya case completed_at hari ini');
    }

    public function test_returns_open_is_current_snapshot(): void
    {
        $product = $this->makeProduct(4);
        $o = $this->makeOrder('081100000005', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);

        $this->makeReturnCase($o, 'open', now()->subDays(2));
        $m = $this->metricsForToday();
        // returns_open = snapshot current (status open), TIDAK dihitung berdasar created_at.
        $this->assertSame(1, $m['returns_open']);
    }

    public function test_refund_given_only_completed_return_case(): void
    {
        $product = $this->makeProduct(5);
        $o1 = $this->makeOrder('081100000006', '200000', 'processing');
        $o2 = $this->makeOrder('081100000007', '200000', 'processing');
        $this->addItem($o1, $product, 1, 200000);
        $this->addItem($o2, $product, 1, 200000);

        $this->makeReturnCase($o1, 'completed', today(), today(), 120000, 1);
        $this->makeReturnCase($o2, 'open', today(), null, 80000, 1);

        $m = $this->metricsForToday();
        $this->assertSame(120000.0, $m['refund_given'], 'hanya case completed');
    }

    public function test_return_rate_created_denominator_and_zero(): void
    {
        $product = $this->makeProduct(6);
        $o = $this->makeOrder('081100000008', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);
        $this->makeReturnCase($o, 'completed', today(), today(), 100000, 1);

        $m = $this->metricsForToday();
        $this->assertSame(100.0, $m['return_rate_created']);

        // zero denominator
        $this->assertSame(0.0, $m['return_rate_completed']);
    }

    public function test_return_rate_completed_denominator(): void
    {
        $product = $this->makeProduct(7);
        $o1 = $this->makeOrder('081100000009', '100000', 'completed');
        $o2 = $this->makeOrder('081100000010', '100000', 'completed');
        $this->addItem($o1, $product, 1, 100000);
        $this->addItem($o2, $product, 1, 100000);
        $this->makeReturnCase($o1, 'completed', today(), today(), 100000, 1);

        $m = $this->metricsForToday();
        $this->assertSame(2, $m['completed_orders']);
        $this->assertSame(1, $m['returns_completed']);
        $this->assertSame(50.0, $m['return_rate_completed']);
    }

    public function test_return_rate_completed_zero_denominator(): void
    {
        $m = $this->metricsForToday();
        $this->assertSame(0.0, $m['return_rate_completed']);
    }

    public function test_repeat_order_rate_uses_customer_phone(): void
    {
        $product = $this->makeProduct(8);
        // Pelanggan 11: prior order KEMARIN (repeat) + order hari ini.
        $prior = $this->makeOrder('081100000011', '100000', 'processing', false, now()->subDays(2));
        $current = $this->makeOrder('081100000011', '150000', 'processing');
        // Pelanggan 12: baru hari ini (new).
        $new = $this->makeOrder('081100000012', '100000', 'processing');
        $this->addItem($prior, $product, 1, 100000);
        $this->addItem($current, $product, 1, 150000);
        $this->addItem($new, $product, 1, 100000);

        $m = $this->metricsForToday();
        // repeat=1 (0811..11 punya prior order), new=1 (0811..12), unique=2 => 50%
        $this->assertSame(1, $m['repeat_customers']);
        $this->assertSame(1, $m['new_customers']);
        $this->assertSame(50.0, $m['repeat_order_rate']);
    }

    public function test_cancelled_order_not_counted_as_valid_repeat(): void
    {
        $product = $this->makeProduct(9);
        $s = $this->makeOrder('081100000013', '100000', 'processing');
        $this->addItem($s, $product, 1, 100000);
        // Order cancelled utk pelanggan yg sama (prior) -> tidak dianggap repeat valid.
        $priorCancelled = $this->makeOrder('081100000013', '100000', 'cancelled');
        $this->addItem($priorCancelled, $product, 1, 100000);

        $m = $this->metricsForToday();
        // repeat dari order VALID prior -> tidak ada (hanya cancelled prior), new=1, repeat=0.
        $this->assertSame(0, $m['repeat_customers']);
        $this->assertSame(0.0, $m['repeat_order_rate']);
    }

    public function test_keys_are_exposed_in_build_sections(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance', ['period' => 'today']))
            ->assertOk();

        // Verify keys exist in build() payload via service directly.
        $service = app(StorePerformanceService::class);
        $report = $service->build('today');
        $allKeys = [];
        foreach ($report['sections'] as $section) {
            foreach ($section['kpis'] as $kpi) {
                $allKeys[] = $kpi['key'];
            }
        }
        $expected = ['aov', 'returns_created', 'returns_open', 'returns_completed', 'refund_given', 'return_rate_created', 'return_rate_completed', 'repeat_order_rate'];
        foreach ($expected as $key) {
            $this->assertContains($key, $allKeys, "KPI $key wajib tampil di section");
        }
    }
}