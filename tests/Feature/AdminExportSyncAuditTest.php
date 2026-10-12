<?php

namespace Tests\Feature;

use App\Exports\OrderExport;
use App\Exports\StorePerformanceExport;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
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

    public function test_order_export_kas_bersih_per_produk_alokasi_subtotal_bukan_qty(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-AUDIT-01',
            'customer_name' => 'Pak Budi',
            'customer_phone' => '085725116817',
            'shipping_address_line1' => 'Jl Magelang',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50123',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 2000000,
            'shipping_amount' => 100000,
            'shipping_subsidy_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 2100000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'cod_fee_amount' => 0,
        ]);

        $prod = Product::create(['parent_sku' => 'SKU-AUDIT-1', 'name' => 'Jendela A', 'category_id' => 1, 'product_category' => 'JENDELA', 'product_model' => 'JUNGKIT', 'status' => 'active']);
        $var1 = ProductVariant::create(['product_id' => $prod->id, 'variant_sku' => 'SKU-A-1', 'price' => 500000, 'stock' => 5, 'weight_kg' => 1.0, 'status' => 'active']);
        $var2 = ProductVariant::create(['product_id' => $prod->id, 'variant_sku' => 'SKU-A-2', 'price' => 1500000, 'stock' => 5, 'weight_kg' => 1.0, 'status' => 'active']);

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

        $this->assertStringContainsString('T3/SUMIF', (string) $tx->getCell('AE3')->getValue());
        $this->assertStringContainsString('T4/SUMIF', (string) $tx->getCell('AE4')->getValue());

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

        $order = Order::create([
            'order_number' => 'ORD-SP-AA-1',
            'customer_name' => 'Budi AA',
            'customer_phone' => '085725116817',
            'shipping_address_line1' => 'Jl AA',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50123',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'in_process',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 50000,
            'total_amount' => 1050000,
            'payment_method' => 'transfer',
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

        Order::create([
            'order_number' => 'ORD-CANCEL-PAY',
            'customer_name' => 'User Batal',
            'customer_phone' => '085725116817',
            'shipping_address_line1' => 'Jl Batal',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '10110',
            'shipping_country' => 'Indonesia',
            'order_status' => 'cancelled',
            'payment_status' => 'cancelled',
            'shipping_status' => 'cancelled',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.orders.export', [
            'payment_status' => 'cancelled',
        ]));
        $response->assertOk();
    }
}
