<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\OrderReturnItem;
use App\Models\Product;
use App\Models\ShippingRecord;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorePerformanceHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function order(string $number, string $status = 'processing', int $total = 1000, string $phone = '081234567890'): Order
    {
        return Order::create([
            'order_number' => $number,
            'customer_name' => 'History Test',
            'customer_phone' => $phone,
            'shipping_address_line1' => 'Jl History',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    private function item(Order $order, int $unitPrice = 1000, int $quantity = 1, string $model = 'SLIDING', string $design = 'PUTIH'): OrderItem
    {
        $product = Product::create([
            'parent_sku' => 'CAT-'.$order->order_number,
            'name' => 'Catalog '.$model,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => $design,
            'status' => 'active',
        ]);

        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => 'HIST-'.$order->order_number,
            'name' => 'Snapshot '.$model,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => $design,
            'unit_price' => $unitPrice,
            'quantity' => $quantity,
            'line_subtotal' => $unitPrice * $quantity,
            'line_discount' => 0,
            'line_total' => $unitPrice * $quantity,
        ]);
    }

    public function test_completed_and_return_metrics_use_locked_contracts(): void
    {
        $completed = $this->order('RA-HIST-COMPLETED', 'completed', 2000);
        $this->item($completed, 1000, 2, 'SLIDING', 'PUTIH');

        $delivered = $this->order('RA-HIST-DELIVERED', 'delivered', 2000);
        $this->item($delivered, 1000, 2, 'SLIDING', 'PUTIH');

        $issue = $this->order('RA-HIST-ISSUE', 'issue', 5000);
        $this->item($issue, 5000, 1, 'ISSUE-ONLY', 'HITAM');

        $returned = $this->order('RA-HIST-RETURNED', 'return_completed', 3000);
        $returnedItem = $this->item($returned, 1000, 3, 'SLIDING', 'PUTIH');
        $case = OrderReturnCase::create([
            'order_id' => $returned->id,
            'status' => 'completed',
            'reason' => 'Ukuran tidak sesuai',
            'refund_amount' => 500,
            'completed_at' => now(),
        ]);
        OrderReturnItem::create([
            'return_case_id' => $case->id,
            'order_item_id' => $returnedItem->id,
            'requested_quantity' => 2,
            'returned_quantity' => 2,
        ]);

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(1, $metrics['completed_orders']);
        $this->assertSame(1, $metrics['return_orders']);
        $this->assertSame(2000.0, $metrics['return_value']);
        $this->assertSame(7000.0, $metrics['gross_revenue']);
        $this->assertSame(500.0, $metrics['refund_adjustments']);
        $this->assertSame(6500.0, $metrics['net_revenue']);
        $this->assertSame(1, $metrics['models_sold']);
    }

    public function test_model_count_reads_order_snapshot_not_live_catalog(): void
    {
        $first = $this->order('RA-HIST-MODEL-1');
        $this->item($first, 1000, 1, 'MODEL-A', 'PUTIH');
        $second = $this->order('RA-HIST-MODEL-2');
        $this->item($second, 1000, 1, 'MODEL-B', 'HITAM');

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(2, $metrics['models_sold']);
    }

    public function test_timing_metrics_use_status_event_and_resi_created_at(): void
    {
        $created = Carbon::today()->setTime(10, 0);
        $order = $this->order('RA-HIST-TIMING');
        $order->created_at = $created;
        $order->save();

        EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['from' => 'pending_payment', 'order_status' => 'processing'],
            'created_at' => $created->copy()->addMinutes(90),
        ]);

        $shipping = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'JNT',
            'service_name' => 'REG',
            'waybill_number' => 'HIST-RESI-001',
            'shipping_cost' => 0,
            'status' => 'pending_pickup',
        ]);
        $shipping->created_at = $created->copy()->addMinutes(210);
        $shipping->save();

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(1.5, $metrics['avg_confirm_hours']);
        $this->assertSame(0.08, $metrics['avg_process_days']);
    }

    public function test_repeat_customer_is_historical_not_only_same_period(): void
    {
        $prior = $this->order('RA-HIST-PRIOR', 'completed', 1000, '081200000001');
        $prior->created_at = now()->subDay();
        $prior->save();

        $current = $this->order('RA-HIST-CURRENT', 'processing', 1000, '081200000001');

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(0, $metrics['new_customers']);
        $this->assertSame(1, $metrics['repeat_customers']);
    }
}
