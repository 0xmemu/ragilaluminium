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

/**
 * Fase 10 — lock StorePerformance handoff rules:
 *   R1  dashboard & Performa Toko page share the exact same formula contract (StorePerformanceService::build).
 *   R4  COD only recognized as paid when the order reaches completed.
 *   R8  model count is computed by a MySQL+SQLite-compatible SQL query (no PHP collection dedupe).
 *   R9  return/refund never deletes raw order/order_items rows.
 *   R10 refund adjustment reduces omzet bersih by refund_amount on completed return ledger.
 */
class StorePerformanceF10RulesTest extends TestCase
{
    use RefreshDatabase;

    private function codOrder(string $number, string $status = 'processing', int $total = 1000): Order
    {
        return Order::create([
            'order_number' => $number,
            'customer_name' => 'COD Order F10',
            'customer_phone' => '081277733311',
            'shipping_address_line1' => 'Jl COD',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
    }

    private function attachItem(Order $order, int $unitPrice = 1000, int $quantity = 1, string $model = 'COD-MODEL', string $design = 'POLOS'): OrderItem
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
            'parent_sku' => 'F10-'.$order->order_number,
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
    public function test_r4_cod_is_not_paid_until_fulfillment_reaches_completed(): void
    {
        // COD in processing / shipped / delivered: cash not yet collected →
        // must NOT contribute to omzet/units/models.
        $this->attachItem($this->codOrder('RA-F10-COD-PROC', 'processing', 1000), 1000, 2, 'M-A', 'P');
        $this->attachItem($this->codOrder('RA-F10-COD-SHIP', 'shipped', 1000), 1000, 1, 'M-B', 'H');
        $this->attachItem($this->codOrder('RA-F10-COD-DELIV', 'delivered', 1000), 1000, 1, 'M-C', 'H');

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(0.0, $metrics['revenue']);
        $this->assertSame(0, $metrics['units']);
        $this->assertSame(0, $metrics['models_sold']);
        $this->assertSame(0, $metrics['completed_orders']);
    }


    public function test_r4_cod_paid_only_when_completed_but_transfer_counts_from_processing(): void
    {
        $this->attachItem($this->codOrder('RA-F10-COD-DONE', 'completed', 3000000), 1000, 3, 'SLIDING', 'PUTIH');

        $transfer = Order::create([
            'order_number' => 'RA-F10-TRANSFER',
            'customer_name' => 'Transfer F10',
            'customer_phone' => '081200099988',
            'shipping_address_line1' => 'Jl Transfer',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 2000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 2000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        $this->attachItem($transfer, 1000, 2, 'T-MODEL', 'POLOS');

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(5_000_000.0, $metrics['revenue']);
        $this->assertSame(5, $metrics['units']);
        $this->assertSame(2, $metrics['models_sold']);
        $this->assertSame(1, $metrics['completed_orders']);
    }

    public function test_r8_model_count_is_sql_distinct_not_php_collection_dedupe(): void
    {
        $first = $this->codOrder('RA-F10-M1', 'completed', 1000);
        $second = $this->codOrder('RA-F10-M2', 'completed', 1000);
        $this->attachItem($first, 1000, 1, 'LOCKED', 'POLOS');
        $this->attachItem($second, 1000, 1, 'LOCKED', 'POLOS');
        $third = $this->codOrder('RA-F10-M3', 'completed', 1000);
        $this->attachItem($third, 1000, 1, 'LOCKED', 'HITAM');

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());

        $this->assertSame(2, $metrics['models_sold']);
        $this->assertSame(3, $metrics['units']);
    }

    public function test_r9_return_and_refund_keep_raw_rows_and_r10_refund_cuts_net(): void
    {
        $order = $this->codOrder('RA-F10-RET', 'completed', 500000);
        $item = $this->attachItem($order, 250000, 2, 'RET-MODEL', 'POLOS');

        $case = \App\Models\OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'Barang rusak',
            'refund_amount' => 150000,
            'completed_at' => now(),
        ]);
        \App\Models\OrderReturnItem::create([
            'return_case_id' => $case->id,
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'order_status' => 'completed']);
        $this->assertDatabaseHas('order_items', ['id' => $item->id, 'quantity' => 2]);
        $this->assertDatabaseHas('order_return_cases', ['id' => $case->id, 'status' => 'completed']);

        $metrics = app(StorePerformanceService::class)->metricsFor(now()->startOfDay(), now()->endOfDay());
        $this->assertSame(500000.0, $metrics['gross_revenue']);
        $this->assertSame(150000.0, $metrics['refund_adjustments']);
        $this->assertSame(350000.0, $metrics['net_revenue']);
    }

    public function test_r1_dashboard_omzet_and_performa_page_share_build_contract(): void
    {
        $this->attachItem($this->codOrder('RA-F10-R1', 'completed', 4_000_000), 1000, 4, 'R1-MODEL', 'POLOS');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.analytics.store-performance', ['period' => 'today']))
            ->assertOk()
            ->assertInertia(fn (Assert $a) => $a
                ->component('Admin/Analytics/StorePerformance')
                ->where('report.financial.gross_revenue', 4_000_000)
                ->where('report.financial.refund_adjustments', 0)
            );

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $a) => $a
                ->component('Admin/Dashboard')
                ->where('omzet.revenue', 4_000_000)
                ->where('performa.period', 'today')
            );
    }

    public function test_r8_query_does_not_rely_on_sqlite_only_functions(): void
    {
        $service = app(StorePerformanceService::class);
        $reflection = new \ReflectionMethod($service, 'paidRevenueStatusSql');
        $reflection->setAccessible(true);
        $sql = $reflection->invoke($service, 'orders');

        $this->assertStringContainsString('order_status', $sql);
        $this->assertStringContainsString('cod_flag', $sql);
        $this->assertStringNotContainsString('strftime', $sql);
        $this->assertStringNotContainsString('group_concat', $sql);
    }
}

