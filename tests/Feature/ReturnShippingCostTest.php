<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\User;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReturnShippingCostTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Concerns\TanamEventPengakuan;

    private function makeProduct(int $sku, int $stock = 50): Product
    {
        return Product::create([
            'parent_sku' => 'ON-'.$sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'stock' => $stock,
        ]);
    }

    private function makeOrder(string $status = 'return_in_process', string $payment = 'paid', float $total = 100000): Order
    {
        $order = Order::create([
            'order_number' => 'ON-'.uniqid(),
            'customer_name' => 'Cust',
            'customer_phone' => '081500000001',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => $payment,
            'shipping_status' => 'delivered',
            'subtotal_amount' => (int) $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => (int) $total,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        return $this->tanamEventPengakuan($order);
    }

    private function addItem(Order $order, Product $product, int $qty = 1, int $price = 100000): OrderItem
    {
        return OrderItem::create([
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

    private function makeOpenCase(Order $order, OrderItem $item, string $faultParty): OrderReturnCase
    {
        $case = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'fault_party' => $faultParty,
            'shipping_cost_borne_by_store' => $faultParty === 'store',
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);
        $case->items()->create([
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 0,
        ]);
        return $case;
    }

    private function makeCompletedCase(Order $order, OrderItem $item, string $faultParty, float $cost): OrderReturnCase
    {
        $case = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => $faultParty,
            'shipping_cost_borne_by_store' => true,
            'resolution_type' => 'refund',
            'refund_amount' => 50000,
            'return_shipping_cost' => $cost,
            'completed_at' => now(),
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);
        $case->items()->create([
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);
        return $case;
    }

    // ---------- ReturnService unit ----------

    public function test_store_fault_requires_shipping_cost(): void
    {
        $service = app(\App\Services\ReturnService::class);
        $r = $service->validateReturnShippingCost('store', 0);
        $this->assertFalse($r['valid']);
        $this->assertStringContainsString('wajib', $r['error']);

        $ok = $service->validateReturnShippingCost('store', 15000);
        $this->assertTrue($ok['valid']);
    }

    public function test_customer_fault_cost_optional(): void
    {
        $service = app(\App\Services\ReturnService::class);
        $this->assertTrue($service->validateReturnShippingCost('customer', 0)['valid']);
        $this->assertTrue($service->validateReturnShippingCost('customer', 25000)['valid']);
        $this->assertTrue($service->validateReturnShippingCost('other', 0)['valid']);
    }

    // ---------- Flow integration via controller ----------

    public function test_store_fault_without_cost_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $p = $this->makeProduct(1);
        $o = $this->makeOrder();
        $item = $this->addItem($o, $p);
        $case = $this->makeOpenCase($o, $item, 'store');

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.complete', ['order' => $o, 'returnCase' => $case]),
            [
                'resolution_type' => 'refund',
                'admin_notes' => 'catatan',
                'refund_amount' => 50000,
                'return_shipping_cost' => 0,
            ]
        );
        $resp->assertSessionHasErrors('return_shipping_cost');
        $case->refresh();
        $this->assertSame('open', $case->status, 'case tidak boleh selesai saat ongkir store kosong');
    }

    public function test_store_fault_with_cost_completes_and_records(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $p = $this->makeProduct(2);
        $o = $this->makeOrder();
        $item = $this->addItem($o, $p);
        $case = $this->makeOpenCase($o, $item, 'store');

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.complete', ['order' => $o, 'returnCase' => $case]),
            [
                'resolution_type' => 'refund',
                'admin_notes' => 'catatan',
                'refund_amount' => 50000,
                'return_shipping_cost' => 15000,
            ]
        );
        $resp->assertSessionHasNoErrors();
        $case->refresh();
        $this->assertSame('completed', $case->status);
        $this->assertSame('15000.00', (string) $case->return_shipping_cost);
        $o->refresh();
        $this->assertSame('return_completed', $o->order_status);
    }

    public function test_customer_fault_zero_cost_fine_and_goodwill_recorded(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $p = $this->makeProduct(3);
        $o = $this->makeOrder();
        $item = $this->addItem($o, $p);
        $case = $this->makeOpenCase($o, $item, 'customer');

        // customer + 0 -> sukses
        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.complete', ['order' => $o, 'returnCase' => $case]),
            ['resolution_type' => 'refund', 'admin_notes' => 'n', 'refund_amount' => 50000, 'return_shipping_cost' => 0]
        );
        $resp->assertSessionHasNoErrors();
        $case->refresh();
        $this->assertSame('completed', $case->status);
        $this->assertSame('0.00', (string) $case->return_shipping_cost);
    }

    // ---------- KPI dashboard ----------

    public function test_kpi_shipping_cost_total_and_cases(): void
    {
        $p = $this->makeProduct(4);
        $o = $this->makeOrder();
        $item = $this->addItem($o, $p);
        $this->makeCompletedCase($o, $item, 'store', 15000);
        $this->makeCompletedCase($o, $item, 'customer', 25000);

        $report = app(StorePerformanceService::class)->build('today');
        $section = collect($report['sections'])->firstWhere('key', 'returns_cancellations');
        $this->assertNotNull($section, 'section Biaya Retur ada');
        $kpis = collect($section['kpis'])->keyBy('key');
        $this->assertSame(40000.0, (float) $kpis['return_shipping_cost_total']['value']);
        $this->assertSame(2, (int) $kpis['return_shipping_cost_cases']['value']);
        $this->assertCount(2, $report['return_shipping_costs']);
    }

    public function test_kpi_shipping_cost_does_not_change_net_revenue(): void
    {
        // Keputusan owner 2026-09-28 MENGHANGUSKAN aturan lama "ongkir retur
        // tidak mengubah net": ongkir retur sekarang PENGURANG Penjualan
        // Bersih. Test lama hanya membandingkan angka dengan dirinya sendiri
        // (vakuo), jadi diganti enam test nyata di bawah.
        $this->assertTrue(method_exists(StorePerformanceService::class, 'build'));
    }

    /** Kasus selesai dengan nominal refund yang bisa diatur. */
    private function makeCompletedCaseRefund(Order $order, OrderItem $item, string $faultParty, float $cost, float $refund): OrderReturnCase
    {
        $case = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => $faultParty,
            'shipping_cost_borne_by_store' => true,
            'resolution_type' => $refund > 0 ? 'refund' : 'no_compensation',
            'refund_amount' => $refund,
            'return_shipping_cost' => $cost,
            'completed_at' => now(),
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);
        $case->items()->create([
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);

        return $case;
    }

    public function test_ongkir_retur_menurunkan_net_revenue(): void
    {
        $p = $this->makeProduct(5);
        $o = $this->makeOrder('processing', 'paid', 100000);
        $item = $this->addItem($o, $p, 1, 100000);
        $this->makeCompletedCaseRefund($o, $item, 'store', 15000, 0);

        $report = app(StorePerformanceService::class)->build('today');
        // Net = Gross 100000 - ongkir retur 15000 (tanpa refund, tanpa ongkir J&T).
        $this->assertSame(85000.0, (float) $report['financial']['net_revenue']);
    }

    public function test_gross_revenue_tidak_berubah_oleh_ongkir_retur(): void
    {
        $p = $this->makeProduct(6);
        $o = $this->makeOrder('processing', 'paid', 100000);
        $item = $this->addItem($o, $p, 1, 100000);

        $reportSebelum = app(StorePerformanceService::class)->build('today');
        $grossSebelum = (float) $reportSebelum['financial']['gross_revenue'];

        $this->makeCompletedCaseRefund($o, $item, 'store', 15000, 0);

        $report = app(StorePerformanceService::class)->build('today');
        $this->assertSame($grossSebelum, (float) $report['financial']['gross_revenue']);
        $this->assertSame(100000.0, (float) $report['financial']['gross_revenue']);
    }

    public function test_ongkir_retur_nol_tidak_mengubah_net(): void
    {
        $p = $this->makeProduct(7);
        $o = $this->makeOrder('processing', 'paid', 100000);
        $item = $this->addItem($o, $p, 1, 100000);
        // goodwill pelanggan: ongkir 0
        $this->makeCompletedCaseRefund($o, $item, 'customer', 0, 0);

        $report = app(StorePerformanceService::class)->build('today');
        $this->assertSame(100000.0, (float) $report['financial']['net_revenue']);
        $section = collect($report['sections'])->firstWhere('key', 'returns_cancellations');
        $kpis = collect($section['kpis'])->keyBy('key');
        $this->assertSame(0.0, (float) $kpis['return_shipping_cost_total']['value']);
    }

    public function test_ongkir_retur_hanya_dihitung_sekali(): void
    {
        $p = $this->makeProduct(8);
        $o = $this->makeOrder('processing', 'paid', 200000);
        $item = $this->addItem($o, $p, 2, 100000);
        $this->makeCompletedCaseRefund($o, $item, 'store', 15000, 0);
        $this->makeCompletedCaseRefund($o, $item, 'customer', 25000, 0);

        $report = app(StorePerformanceService::class)->build('today');
        // Dua kasus: total ongkir 40000 TEPAT SEKALI sebagai pengurang net,
        // bukan dua kali per daftar ataupun per KPI.
        $this->assertSame(40000.0, (float) $report['financial']['return_shipping_store']);
        $this->assertSame(160000.0, (float) $report['financial']['net_revenue']);
        $this->assertCount(2, $report['return_shipping_costs']);
    }

    public function test_kasus_retur_tanpa_completed_at_tidak_masuk_periode(): void
    {
        $p = $this->makeProduct(9);
        $o = $this->makeOrder('processing', 'paid', 100000);
        $item = $this->addItem($o, $p, 1, 100000);
        $case = $this->makeCompletedCaseRefund($o, $item, 'store', 15000, 0);

        // Bypass event model: hook saving selalu mengisi completed_at saat
        // status completed, jadi null hanya mungkin lewat query langsung.
        DB::table('order_return_cases')->where('id', $case->id)->update(['completed_at' => null]);

        $report = app(StorePerformanceService::class)->build('today');
        $this->assertSame(0.0, (float) $report['financial']['return_shipping_store']);
        $this->assertSame(100000.0, (float) $report['financial']['net_revenue']);
        $this->assertCount(0, $report['return_shipping_costs']);
    }

    public function test_kasus_selesai_periode_berikutnya_masuk_periode_itu(): void
    {
        $p = $this->makeProduct(10);
        $o = $this->makeOrder('processing', 'paid', 100000);
        $item = $this->addItem($o, $p, 1, 100000);

        $case = $this->makeCompletedCaseRefund($o, $item, 'store', 15000, 0);
        // Kasus selesai LIMA HARI LALU: bukan periode hari ini, melainkan
        // periode lain. Rentang masa depan dipotong pengaman rentang, jadi
        // periode pembandingnya dipakai masa lalu; mekanisme anggotanya sama:
        // kasus masuk di periode tanggal completed_at-nya, bukan periode
        // tanggal pesanan dibuat.
        $selesaiAt = now()->subDays(5);
        DB::table('order_return_cases')->where('id', $case->id)->update([
            'completed_at' => $selesaiAt->toDateTimeString(),
        ]);

        // Hari ini tidak masuk.
        $reportHariIni = app(StorePerformanceService::class)->build('today');
        $this->assertSame(0.0, (float) $reportHariIni['financial']['return_shipping_store']);

        // Periode yang mencakup tanggal selesainya kasus: masuk di sana.
        $reportLalu = app(StorePerformanceService::class)->build(
            'custom',
            $selesaiAt->copy()->subDay()->toDateString(),
            $selesaiAt->copy()->addDay()->toDateString(),
        );
        $this->assertSame(15000.0, (float) $reportLalu['financial']['return_shipping_store']);
        // Ongkir retur dihitung di periode kasusnya selesai; pesanan itu
        // sendiri diakui di periode pembuatannya, jadi net periode lalu hanya
        // memuat pengurang ongkir (0 - 15000).
        $this->assertSame(-15000.0, (float) $reportLalu['financial']['net_revenue']);
    }
}