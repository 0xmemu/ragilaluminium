<?php

namespace Tests\Feature;

use App\Exports\OrderExport;
use App\Exports\StorePerformanceExport;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingRecord;
use App\Models\User;
use App\Support\IncomeDetailQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class AdminExportSyncAuditTest extends TestCase
{
    use RefreshDatabase;

    private function makeAdmin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function createOrder(array $attributes): Order
    {
        $defaults = [
            'customer_name' => 'Budi Test',
            'customer_phone' => '085725116817',
            'shipping_address_line1' => 'Jl Magelang No 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50123',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 50000,
            'total_amount' => 1050000,
            'payment_method' => 'transfer',
        ];

        $created = $attributes['created_at'] ?? null;
        unset($attributes['created_at']);

        $order = Order::create(array_merge($defaults, $attributes));
        if ($created) {
            Order::whereKey($order->id)->update(['created_at' => $created, 'updated_at' => $created]);
        }

        return $order;
    }

    public function test_order_export_kas_bersih_per_produk_alokasi_subtotal_bukan_qty(): void
    {
        $order = $this->createOrder([
            'order_number' => 'ORD-AUDIT-01',
            'subtotal_amount' => 2000000,
            'shipping_amount' => 100000,
            'total_amount' => 2100000,
        ]);

        $prod = Product::create(['parent_sku' => 'SKU-AUDIT-1', 'name' => 'Jendela A', 'category_id' => 1, 'product_category' => 'JENDELA', 'product_model' => 'JUNGKIT', 'status' => 'active']);
        $var1 = ProductVariant::create(['product_id' => $prod->id, 'variant_sku' => 'SKU-A-1', 'price' => 500000, 'stock' => 5, 'weight_kg' => 1.0, 'status' => 'active']);
        $var2 = ProductVariant::create(['product_id' => $prod->id, 'variant_sku' => 'SKU-A-2', 'price' => 1500000, 'stock' => 5, 'weight_kg' => 1.0, 'status' => 'active']);

        // Item 1: 1 unit x 500.000 = 500.000 (25% share)
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $prod->id,
            'product_variant_id' => $var1->id,
            'parent_sku' => 'SKU-AUDIT-1',
            'variant_sku' => 'SKU-A-1',
            'name' => 'Jendela A Kecil',
            'unit_price' => 500000,
            'quantity' => 1,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'line_total' => 500000,
        ]);

        // Item 2: 1 unit x 1.500.000 = 1.500.000 (75% share)
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $prod->id,
            'product_variant_id' => $var2->id,
            'parent_sku' => 'SKU-AUDIT-1',
            'variant_sku' => 'SKU-A-2',
            'name' => 'Jendela A Besar',
            'unit_price' => 1500000,
            'quantity' => 1,
            'line_subtotal' => 1500000,
            'line_discount' => 0,
            'line_total' => 1500000,
        ]);

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'JNT',
            'waybill_number' => 'RESI999',
            'shipping_cost' => 100000,
            'status' => 'delivered',
        ]);

        Excel::store(new OrderExport(Order::query()->where('id', $order->id)), 'audit_test_order.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('audit_test_order.xlsx'));

        $tx = $ss->getSheetByName(OrderExport::SHEET_TX);
        $rk = $ss->getSheetByName(OrderExport::SHEET_REKAP);

        // Rumus alokasi Kas Bersih per Produk wajib menunjuk kolom subtotal T, bukan kuantitas R
        $this->assertStringContainsString('T3/SUMIF', (string) $tx->getCell('AE3')->getValue());
        $this->assertStringContainsString('T4/SUMIF', (string) $tx->getCell('AE4')->getValue());

        // Net Order = Gross (2.100.000) - JNT (100.000) = 2.000.000
        $kasBersihTotal = (float) $rk->getCell('V3')->getCalculatedValue();
        $this->assertEquals(2000000, $kasBersihTotal, 'Kas Bersih Toko di Sheet Rekap = 2.000.000');

        $item1Net = (float) $tx->getCell('AE3')->getCalculatedValue();
        $item2Net = (float) $tx->getCell('AE4')->getCalculatedValue();

        $this->assertEquals(500000, $item1Net, 'Item 1 mendapat 25% dari 2.000.000 = 500.000');
        $this->assertEquals(1500000, $item2Net, 'Item 2 mendapat 75% dari 2.000.000 = 1.500.000');
        $this->assertEquals($kasBersihTotal, $item1Net + $item2Net, 'Penjumlahan baris produk sama dengan Kas Bersih Toko di Rekap');
    }

    public function test_store_performance_tabel_pesanan_mencakup_kolom_aa_dan_rumus_r_terhitung_lengkap(): void
    {
        $admin = $this->makeAdmin();

        $order = $this->createOrder([
            'order_number' => 'ORD-SP-AA-1',
            'order_status' => 'processing',
        ]);

        EventLog::create([
            'entity_type' => 'order',
            'entity_id' => (string) $order->id,
            'event_type' => 'order_status_changed',
            'payload' => ['order_status' => 'processing'],
            'created_at' => now(),
        ]);

        $payload = app(\App\Services\StorePerformanceService::class)->build('today');
        $payload['income_detail'] = IncomeDetailQuery::orders($payload['range']['from_date_iso'], $payload['range']['to_date_iso']);
        $payload['sold_items'] = IncomeDetailQuery::items($payload['range']['from_date_iso'], $payload['range']['to_date_iso']);

        Excel::store(new StorePerformanceExport($payload), 'audit_sp_test.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('audit_sp_test.xlsx'));

        $rp = $ss->getSheetByName('Tabel Pesanan');
        $tables = $rp->getTableCollection();

        $this->assertCount(1, $tables);
        $t = $tables[0];
        $this->assertStringContainsString(':AA', $t->getRange(), 'Tabel mencakup hingga kolom AA');
        $this->assertStringContainsString('+AA2', (string) $rp->getCell('R2')->getValue(), 'Rumus R2 menyertakan kolom AA');
    }

    public function test_order_export_filter_payment_status_cancelled(): void
    {
        $admin = $this->makeAdmin();

        $this->createOrder([
            'order_number' => 'ORD-CANCEL-PAY',
            'order_status' => 'cancelled',
            'payment_status' => 'cancelled',
            'shipping_status' => 'cancelled',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.orders.export', [
            'payment_status' => 'cancelled',
        ]));
        $response->assertOk();
    }

    public function test_income_detail_items_recognition_contract(): void
    {
        $from = '2026-09-01';
        $to = '2026-09-30';

        $prod = Product::create(['parent_sku' => 'SKU-REC-1', 'name' => 'Jendela Test', 'category_id' => 1, 'product_category' => 'JENDELA', 'product_model' => 'JUNGKIT', 'status' => 'active']);

        // 1. Order belum diproses (awaiting_confirmation) -> TIDAK diakui
        $ord1 = $this->createOrder([
            'order_number' => 'ORD-REC-BELUM',
            'order_status' => 'awaiting_confirmation',
            'total_amount' => 100000,
            'created_at' => '2026-09-10 10:00:00',
        ]);
        OrderItem::create(['order_id' => $ord1->id, 'product_id' => $prod->id, 'parent_sku' => 'SKU-REC-1', 'name' => 'Item 1', 'unit_price' => 100000, 'quantity' => 1, 'line_subtotal' => 100000, 'line_total' => 100000]);

        // 2. Order diproses dalam periode -> DIAKUI
        $ord2 = $this->createOrder([
            'order_number' => 'ORD-REC-MASUK',
            'order_status' => 'processing',
            'total_amount' => 200000,
            'created_at' => '2026-09-15 10:00:00',
        ]);
        OrderItem::create(['order_id' => $ord2->id, 'product_id' => $prod->id, 'parent_sku' => 'SKU-REC-1', 'name' => 'Item 2', 'unit_price' => 200000, 'quantity' => 1, 'line_subtotal' => 200000, 'line_total' => 200000]);
        EventLog::create([
            'entity_type' => 'order', 'entity_id' => (string) $ord2->id,
            'event_type' => 'order_status_changed', 'payload' => ['order_status' => 'processing'],
            'created_at' => '2026-09-15 11:00:00',
        ]);

        // 3. Order diproses SETELAH periode berakhir (Oktober) -> TIDAK diakui untuk September
        $ord3 = $this->createOrder([
            'order_number' => 'ORD-REC-LATE',
            'order_status' => 'processing',
            'total_amount' => 300000,
            'created_at' => '2026-09-20 10:00:00',
        ]);
        OrderItem::create(['order_id' => $ord3->id, 'product_id' => $prod->id, 'parent_sku' => 'SKU-REC-1', 'name' => 'Item 3', 'unit_price' => 300000, 'quantity' => 1, 'line_subtotal' => 300000, 'line_total' => 300000]);
        EventLog::create([
            'entity_type' => 'order', 'entity_id' => (string) $ord3->id,
            'event_type' => 'order_status_changed', 'payload' => ['order_status' => 'processing'],
            'created_at' => '2026-10-02 09:00:00',
        ]);

        // 4. Order dibatalkan -> TIDAK diakui
        $ord4 = $this->createOrder([
            'order_number' => 'ORD-REC-BATAL',
            'order_status' => 'cancelled',
            'total_amount' => 400000,
            'created_at' => '2026-09-22 10:00:00',
        ]);
        OrderItem::create(['order_id' => $ord4->id, 'product_id' => $prod->id, 'parent_sku' => 'SKU-REC-1', 'name' => 'Item 4', 'unit_price' => 400000, 'quantity' => 1, 'line_subtotal' => 400000, 'line_total' => 400000]);

        // 5. Order tepat pada detik batas akhir 23:59:59 -> MASUK
        $ord5 = $this->createOrder([
            'order_number' => 'ORD-REC-BATAS',
            'order_status' => 'shipped',
            'total_amount' => 500000,
            'created_at' => '2026-09-30 23:59:59',
        ]);
        OrderItem::create(['order_id' => $ord5->id, 'product_id' => $prod->id, 'parent_sku' => 'SKU-REC-1', 'name' => 'Item 5', 'unit_price' => 500000, 'quantity' => 1, 'line_subtotal' => 500000, 'line_total' => 500000]);
        EventLog::create([
            'entity_type' => 'order', 'entity_id' => (string) $ord5->id,
            'event_type' => 'order_status_changed', 'payload' => ['order_status' => 'processing'],
            'created_at' => '2026-09-30 23:59:59',
        ]);

        $items = IncomeDetailQuery::items($from, $to);
        $orderNumbers = array_column($items, 'order_number');

        $this->assertContains('ORD-REC-MASUK', $orderNumbers, 'Order yang diproses dalam periode masuk');
        $this->assertContains('ORD-REC-BATAS', $orderNumbers, 'Order pada detik 23:59:59 batas akhir tidak terpotong');
        $this->assertNotContains('ORD-REC-BELUM', $orderNumbers, 'Order belum diproses tidak masuk');
        $this->assertNotContains('ORD-REC-LATE', $orderNumbers, 'Order yang diproses setelah periode berakhir tidak masuk');
        $this->assertNotContains('ORD-REC-BATAL', $orderNumbers, 'Order dibatalkan tidak masuk');
    }

    public function test_multi_return_cases_accumulation_and_voided_exclusion(): void
    {
        $order = $this->createOrder([
            'order_number' => 'ORD-MULTI-RET',
            'subtotal_amount' => 5000000,
            'total_amount' => 5000000,
            'created_at' => '2026-09-01 10:00:00',
        ]);

        $prod = Product::create(['parent_sku' => 'SKU-RET-1', 'name' => 'Pintu Retur', 'category_id' => 1, 'product_category' => 'PINTU', 'product_model' => 'SLIDING', 'status' => 'active']);
        OrderItem::create(['order_id' => $order->id, 'product_id' => $prod->id, 'parent_sku' => 'SKU-RET-1', 'name' => 'Pintu Sliding', 'unit_price' => 5000000, 'quantity' => 1, 'line_subtotal' => 5000000, 'line_total' => 5000000]);

        // Kasus 1: Selesai
        OrderReturnCase::create([
            'order_id' => $order->id,
            'reason' => 'Barang rusak kaca retak',
            'status' => 'completed',
            'resolution_type' => 'refund',
            'refund_amount' => 50000,
            'return_shipping_cost' => 15000,
            'additional_shipping_amount' => 10000,
            'completed_at' => '2026-09-05 10:00:00',
        ]);

        // Kasus 2: Selesai (kasus tambahan pada pesanan sama)
        OrderReturnCase::create([
            'order_id' => $order->id,
            'reason' => 'Kompensasi ongkir tambahan',
            'status' => 'completed',
            'resolution_type' => 'compensation',
            'refund_amount' => 25000,
            'return_shipping_cost' => 5000,
            'additional_shipping_amount' => 5000,
            'completed_at' => '2026-09-10 10:00:00',
        ]);

        // Kasus 3: Masih Open (tidak boleh ikut dihitung selesai)
        OrderReturnCase::create([
            'order_id' => $order->id,
            'reason' => 'Masih diperiksa',
            'status' => 'open',
            'refund_amount' => 100000,
            'return_shipping_cost' => 20000,
            'additional_shipping_amount' => 20000,
        ]);

        // Kasus 4: Selesai tapi di-VOID (tidak boleh ikut dihitung)
        OrderReturnCase::create([
            'order_id' => $order->id,
            'reason' => 'Koreksi salah input void',
            'status' => 'completed',
            'refund_amount' => 999999,
            'return_shipping_cost' => 999999,
            'additional_shipping_amount' => 999999,
            'completed_at' => '2026-09-12 10:00:00',
            'voided_at' => '2026-09-13 10:00:00',
        ]);

        Excel::store(new OrderExport(Order::query()->where('id', $order->id)), 'audit_multi_ret.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('audit_multi_ret.xlsx'));

        $rk = $ss->getSheetByName(OrderExport::SHEET_REKAP);

        // Rekap baris 3: Kasus 1 + Kasus 2 saja (75.000 refund, 20.000 retur ongkir)
        $this->assertEquals(75000, (float) $rk->getCell('T3')->getValue(), 'Refund = 50.000 + 25.000');
        $this->assertEquals(20000, (float) $rk->getCell('U3')->getValue(), 'Ongkir retur toko = 15.000 + 5.000');

        $tx = $ss->getSheetByName(OrderExport::SHEET_TX);
        // Kolom AN ongkir perjalanan balik = 10.000 + 5.000 = 15.000
        $this->assertEquals(15000, (float) $tx->getCell('AN3')->getValue(), 'Ongkir perjalanan balik = 10.000 + 5.000');
    }
}
