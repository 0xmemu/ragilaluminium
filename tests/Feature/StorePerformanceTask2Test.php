<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StorePerformanceTask2Test extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(int $sku): Product
    {
        return Product::create([
            'parent_sku' => 'T2-'.$sku,
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
            'order_number' => 'T2-'.uniqid(),
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
        return $order->fresh();
    }

    private function makePayment(Order $order, string $method, string $amount, string $status, ?Carbon $paidAt = null): Payment
    {
        $attrs = [
            'order_id' => $order->id,
            'payment_method' => $method,
            'amount' => $amount,
            'status' => $status,
            'paid_at' => $paidAt,
        ];
        return Payment::create($attrs);
    }

    private function makeCancelEvent(int $orderId, ?int $actorUserId, ?Carbon $createdAt = null): EventLog
    {
        $attrs = [
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $orderId,
            'payload' => ['from' => 'processing', 'order_status' => 'cancelled', 'source' => 'admin_cancel'],
            'created_by_user_id' => $actorUserId,
            'created_at' => $createdAt ?? now(),
        ];
        return EventLog::create($attrs);
    }

    private function metricsForToday(): array
    {
        return app(StorePerformanceService::class)->metricsFor(
            Carbon::today()->startOfDay(),
            Carbon::today()->endOfDay(),
        );
    }

    public function test_payments_received_only_completed_with_paid_at(): void
    {
        $product = $this->makeProduct(1);
        $o = $this->makeOrder('081200000001', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);

        $this->makePayment($o, 'transfer', '100000', 'completed', today()->startOfDay()->addHour());
        $this->makePayment($o, 'transfer', '50000', 'pending', null);

        $m = $this->metricsForToday();
        $this->assertSame(100000.0, $m['payments_received'], 'hanya completed dgn paid_at');
    }

    public function test_payments_received_excludes_paid_at_outside_period_and_refunded(): void
    {
        $product = $this->makeProduct(2);
        $o = $this->makeOrder('081200000002', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);

        // completed tapi paid_at kemarin -> di luar periode
        $this->makePayment($o, 'transfer', '100000', 'completed', today()->subDay());
        // refunded -> tidak masuk payments_received
        $this->makePayment($o, 'transfer', '50000', 'refunded', today()->startOfDay());

        $m = $this->metricsForToday();
        $this->assertSame(0.0, $m['payments_received']);
    }

    public function test_cod_paid_counts_completed_payment_record_not_smart_of_orders(): void
    {
        $product = $this->makeProduct(3);
        $o = $this->makeOrder('081200000003', '200000', 'processing');
        $this->addItem($o, $product, 1, 200000);

        // payment COD completed hari ini
        $this->makePayment($o, 'cod', '200000', 'completed', today()->startOfDay()->addHour());
        // payment COD pending -> tidak
        $this->makePayment($o, 'cod', '90000', 'pending', null);
        // payment transfer completed -> bukan COD
        $this->makePayment($o, 'transfer', '100000', 'completed', today()->startOfDay()->addHour());

        $m = $this->metricsForToday();
        $this->assertSame(200000.0, $m['cod_paid'], 'hanya payment COD completed');
    }

    public function test_payment_pending_count_is_current_snapshot(): void
    {
        $product = $this->makeProduct(4);
        $o1 = $this->makeOrder('081200000004', '100000', 'processing');
        $o2 = $this->makeOrder('081200000005', '100000', 'processing');
        $this->addItem($o1, $product, 1, 100000);
        $this->addItem($o2, $product, 1, 100000);

        $this->makePayment($o1, 'transfer', '100000', 'pending', null);
        $this->makePayment($o2, 'transfer', '100000', 'completed', today()->startOfDay());

        $m = $this->metricsForToday();
        $this->assertSame(1, $m['payment_pending_count']);
    }

    public function test_cancelled_orders_counts_distinct_event_entity_in_period(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct(5);
        $o1 = $this->makeOrder('081200000006', '100000', 'processing');
        $o2 = $this->makeOrder('081200000007', '100000', 'processing');
        $this->addItem($o1, $product, 1, 100000);
        $this->addItem($o2, $product, 1, 100000);

        // 2 order dibatalkan hari ini (actor admin)
        $this->makeCancelEvent($o1->id, $admin->id, today()->startOfDay()->addMinutes(5));
        $this->makeCancelEvent($o2->id, $admin->id, today()->startOfDay()->addMinutes(6));
        // 1 order dibatalkan kemarin -> luar periode
        $o3 = $this->makeOrder('081200000008', '100000', 'processing');
        $this->addItem($o3, $product, 1, 100000);
        $this->makeCancelEvent($o3->id, $admin->id, now()->subDays(2));

        $m = $this->metricsForToday();
        $this->assertSame(2, $m['cancelled_orders']);
    }

    public function test_cancelled_by_customer_and_store_via_created_by_user_id(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct(6);
        $o1 = $this->makeOrder('081200000009', '100000', 'processing');
        $o2 = $this->makeOrder('081200000010', '100000', 'processing');
        $this->addItem($o1, $product, 1, 100000);
        $this->addItem($o2, $product, 1, 100000);

        // o1 dibatalkan pelanggan (created_by_user_id null), o2 dibatalkan admin (user id)
        $this->makeCancelEvent($o1->id, null, today()->startOfDay()->addMinutes(5));
        $this->makeCancelEvent($o2->id, $admin->id, today()->startOfDay()->addMinutes(6));

        $m = $this->metricsForToday();
        $this->assertSame(1, $m['cancelled_by_customer']);
        $this->assertSame(1, $m['cancelled_by_store']);
    }

    public function test_cancellation_rate_formula(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct(7);
        // 3 order valid fulfillment (processing) hari ini
        $a = $this->makeOrder('081200000011', '100000', 'processing');
        $b = $this->makeOrder('081200000012', '100000', 'processing');
        $c = $this->makeOrder('081200000013', '100000', 'processing');
        $this->addItem($a, $product, 1, 100000);
        $this->addItem($b, $product, 1, 100000);
        $this->addItem($c, $product, 1, 100000);
        // 1 dibatalkan
        $this->makeCancelEvent($c->id, $admin->id, today()->startOfDay()->addMinutes(5));

        $m = $this->metricsForToday();
        // rate = cancelled/(cancelled+orders) = 1/(1+3) = 25
        $this->assertSame(25.0, $m['cancellation_rate']);
    }

    public function test_cancellation_rate_zero_when_no_event_and_no_orders(): void
    {
        $m = $this->metricsForToday();
        $this->assertSame(0.0, $m['cancellation_rate']);
    }

    public function test_task2_keys_exposed_in_build_sections(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance', ['period' => 'today']))
            ->assertOk();

        $service = app(StorePerformanceService::class);
        $report = $service->build('today');
        $allKeys = [];
        foreach ($report['sections'] as $section) {
            $allKeys[$section['key']] = collect($section['kpis'])->pluck('key')->all();
        }
        $this->assertContains('payments_received', $allKeys['payments']);
        $this->assertContains('cod_paid', $allKeys['payments']);
        $this->assertContains('payment_pending_count', $allKeys['payments']);
        $this->assertContains('cancelled_orders', $allKeys['returns_cancellations']);
        $this->assertContains('cancellation_rate', $allKeys['returns_cancellations']);
    }

    public function test_duplicate_cancel_event_same_order_counts_once(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct(8);
        $o = $this->makeOrder('081200000014', '100000', 'processing');
        $this->addItem($o, $product, 1, 100000);

        // Dua event cancelled utk order yg sama (retry/duplikat) -> DISTINCT entity_id => 1
        $this->makeCancelEvent($o->id, $admin->id, today()->startOfDay()->addMinutes(1));
        $this->makeCancelEvent($o->id, $admin->id, today()->startOfDay()->addMinutes(2));

        $m = $this->metricsForToday();
        $this->assertSame(1, $m['cancelled_orders'], 'dedupe per order');
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
}