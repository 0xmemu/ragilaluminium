<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\OrderReturnCase;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class OrderExportContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_export_is_per_item_with_template_columns(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $order = Order::create([
            'order_number' => 'ORD-EXP-001',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Pemuda No. 1',
            'shipping_city' => 'Banjarnegara',
            'shipping_province' => 'Jawa Tengah',
            'shipping_district' => 'Banjarnegara',
            'shipping_village' => 'Sokanandi',
            'shipping_postal_code' => '53411',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 2000000,
            'shipping_amount' => 150000,
            'shipping_subsidy_amount' => 20000,
            'discount_amount' => 0,
            'total_amount' => 2130000,
            'payment_method' => 'cod',
            'cod_flag' => true,
            'cod_fee_amount' => 5000,
        ]);

        // dua produk beda = dua baris
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => Product::create(['parent_sku' => 'PSKU-'.substr(md5(uniqid()), 0, 6), 'name' => 'Produk Uji', 'category_id' => 1, 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'status' => 'archived'])->id,
            'parent_sku' => 'RA-A',
            'variant_sku' => 'RA-A-1',
            'name' => 'Jendela Jungkit A',
            'unit_price' => 1250000,
            'quantity' => 1,
            'line_subtotal' => 1250000,
            'line_discount' => 50000,
            'discount_source' => 'flashsale',
            'line_total' => 1200000,
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => Product::create(['parent_sku' => 'PSKU-'.substr(md5(uniqid()), 0, 6), 'name' => 'Produk Uji', 'category_id' => 1, 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'status' => 'archived'])->id,
            'parent_sku' => 'RA-B',
            'variant_sku' => 'RA-B-1',
            'name' => 'Pintu Sliding B',
            'unit_price' => 750000,
            'quantity' => 2,
            'line_subtotal' => 1500000,
            'line_discount' => 0,
            'discount_source' => 'reg',
            'line_total' => 1500000,
        ]);

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'JNT',
            'waybill_number' => 'RESI1234567890',
            'shipping_cost' => 150000,
            'status' => 'delivered',
        ]);

        // retur SELESAI dgn refund -> refund tampil
        $case = new OrderReturnCase([
            'status' => 'completed',
            'reason' => 'pecah',
            'resolution_type' => 'refund',
            'refund_amount' => 300000,
            'additional_shipping_amount' => 25000,
        ]);
        $case->order_id = $order->id;
        $case->save();

        $export = new \App\Exports\OrderExport(Order::query());
        Excel::store($export, 'exp.xlsx', 'imports');
        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('exp.xlsx');

        $sheet = IOFactory::load($path)->getActiveSheet();
        $headings = $sheet->rangeToArray('A1:AB1')[0];
        $rows = $sheet->toArray(null, true, true, true);

        $this->assertSame('NO. ORDER', $headings[0]);
        $this->assertSame('SKU ID', $headings[5]);
        $this->assertSame('TYPE DISKON', $headings[13]);
        $this->assertSame('ALAMAT LENGKAP', $headings[27]);

        $dataRows = array_values(array_slice($rows, 1, 2));
        $this->assertCount(2, $dataRows, '2 item = 2 baris');

        $r1 = array_values($dataRows[0]);
        $r2 = array_values($dataRows[1]);
        // baris sama-sama punya no order + pelanggan sama
        $this->assertSame('ORD-EXP-001', $r1[0]);
        $this->assertSame('ORD-EXP-001', $r2[0]);
        $this->assertSame('Budi Santoso', $r1[20]);
        $this->assertSame('Budi Santoso', $r2[20]);
        // dibedakan produk
        $this->assertSame('RA-A-1', $r1[5]);
        $this->assertSame('RA-B-1', $r2[5]);
        // qty + harga per item
        $this->assertSame(1, (int) $r1[8]);
        $this->assertSame(2, (int) $r2[8]);
        // type diskon
        $this->assertSame('Flashsale', $r1[13]);
        $this->assertSame('Reguler', $r2[13]);
        // refund hanya dari case completed
        $this->assertSame('Rp 300,000', $r1[17]);
        $this->assertSame('Rp 25,000', $r1[18]);
        // resi
        $this->assertSame('RESI1234567890', $r1[19]);
        // alamat lengkap
        $this->assertSame('53411', $r1[22]);
        $this->assertSame('Banjarnegara', $r1[25]);
    }

    public function test_running_return_shows_zero_refund(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-EXP-002',
            'customer_name' => 'Sari',
            'customer_phone' => '081111111111',
            'shipping_address_line1' => 'Jl. Mawar 2',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50100',
            'order_status' => 'return_in_process',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 500000,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => Product::create(['parent_sku' => 'PSKU-'.substr(md5(uniqid()), 0, 6), 'name' => 'Produk Uji', 'category_id' => 1, 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'status' => 'archived'])->id,
            'parent_sku' => 'RA-C',
            'variant_sku' => null,
            'name' => 'Kusen C',
            'unit_price' => 500000,
            'quantity' => 1,
            'line_subtotal' => 500000,
            'line_discount' => 0,
            'discount_source' => 'reg',
            'line_total' => 500000,
        ]);
        $case = new OrderReturnCase([
            'status' => 'open',
            'reason' => 'salah_ukuran',
            'resolution_type' => 'refund',
            'refund_amount' => 0,
        ]);
        $case->order_id = $order->id;
        $case->save();

        $export = new \App\Exports\OrderExport(Order::query());
        Excel::store($export, 'exp2.xlsx', 'imports');
        $sheet = \PhpOffice\PhpSpreadsheet\IOFactory::load(
            \Illuminate\Support\Facades\Storage::disk('imports')->path('exp2.xlsx')
        )->getActiveSheet();
        $row = array_values(array_slice($sheet->toArray(null, true, true, true), 1, 1)[0]);

        $this->assertSame('Retur diproses (salah_ukuran)', $row[4]);
        $this->assertEquals(0, $row[17], 'retur belum selesai = refund belum terjadi');
    }
}
