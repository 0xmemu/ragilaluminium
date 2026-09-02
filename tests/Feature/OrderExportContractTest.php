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
            'subtotal_amount' => 2750000,
            'shipping_amount' => 150000,
            'shipping_subsidy_amount' => 20000,
            'discount_amount' => 0,
            'total_amount' => 2885000,
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

        $ss = IOFactory::load($path);
        $this->assertSame(['Laporan Pesanan', 'Panduan'], $ss->getSheetNames(), 'XLSX punya sheet data + panduan');

        $sheet = $ss->getSheetByName('Laporan Pesanan');
        $headings = $sheet->rangeToArray('A1:AC1')[0];
        $rows = $sheet->toArray(null, true, true, true);

        // header memakai NAMA SISTEM (kunci DB snake_case), bukan label karangan
        $this->assertSame('order_number', $headings[0]);
        $this->assertSame('variant_sku', $headings[5]);
        $this->assertSame('discount_source', $headings[13]);
        $this->assertSame('additional_shipping_amount', $headings[18]);
        $this->assertSame('net_income', $headings[19]);
        $this->assertSame('waybill_number', $headings[20]);
        $this->assertSame('shipping_address', $headings[28]);
        $this->assertCount(29, $headings);

        $dataRows = array_values(array_slice($rows, 1, 2));
        $this->assertCount(2, $dataRows, '2 item = 2 baris');

        $r1 = array_values($dataRows[0]);
        $r2 = array_values($dataRows[1]);
        // baris sama-sama punya no order + pelanggan sama
        $this->assertSame('ORD-EXP-001', $r1[0]);
        $this->assertSame('ORD-EXP-001', $r2[0]);
        $this->assertSame('Budi Santoso', $r1[21]);
        $this->assertSame('Budi Santoso', $r2[21]);
        // dibedakan produk
        $this->assertSame('RA-A-1', $r1[5]);
        $this->assertSame('RA-B-1', $r2[5]);
        // qty + harga per item (format angka polos, tanpa Rp)
        $this->assertSame('1', $r1[8]);
        $this->assertSame('2', $r2[8]);
        $this->assertSame('1,250,000', $r1[9]);
        $this->assertSame('750,000', $r2[9]);
        // diskon produk; 0 tetap tampil (tidak dibuang writer)
        $this->assertSame('50,000', $r1[12]);
        $this->assertSame('0', $r2[12]);
        // type diskon
        $this->assertSame('Flashsale', $r1[13]);
        $this->assertSame('Reguler', $r2[13]);
        // Biaya level order DIBAGI proporsional ke semua item:
        // bagian item = (nilai item / subtotal 2.750.000) x biaya total.
        // Item A nilai 1.250.000 (rasio 0,4545), item B 1.500.000 (0,5455).
        // ONGKOS 150.000: A 68.182, B 81.818 (jumlah 150.000)
        $this->assertSame('68,182', $r1[14]);
        $this->assertSame('81,818', $r2[14]);
        // SUBSIDI 20.000: A 9.091, B 10.909
        $this->assertSame('9,091', $r1[15]);
        $this->assertSame('10,909', $r2[15]);
        // BIAYA COD 5.000: A 2.273, B 2.727 (jumlah 5.000)
        $this->assertSame('2,273', $r1[16]);
        $this->assertSame('2,727', $r2[16]);
        // REFUND 300.000: A 136.364, B 163.636
        $this->assertSame('136,364', $r1[17]);
        $this->assertSame('163,636', $r2[17]);
        // ONGKIR RETUR 25.000: A 11.364, B 13.636
        $this->assertSame('11,364', $r1[18]);
        $this->assertSame('13,636', $r2[18]);
        // penghasilan bersih per item:
        // A: 1.250.000 - 50.000 - (9.091 + 2.273 + 136.364 + 11.364) = 1.040.909
        $this->assertSame('1,040,909', $r1[19]);
        // B: 1.500.000 - 0 - (10.909 + 2.727 + 163.636 + 13.636) = 1.309.091
        $this->assertSame('1,309,091', $r2[19]);
        // resi
        $this->assertSame('RESI1234567890', $r1[20]);
        // alamat lengkap
        $this->assertSame('53411', $r1[23]);
        $this->assertSame('Banjarnegara', $r1[26]);

        // nilai sel tetap NUMERIK (format hanya tampilan) -> sistem bisa membaca
        $raw = array_values(array_slice($ss->getSheetByName('Laporan Pesanan')->toArray(null, true, false), 1, 2)[0]);
        $this->assertEquals(1250000.0, (float) $raw[9]);
        $this->assertEqualsWithDelta(2272.727, (float) $raw[16], 0.01, 'COD item A = 5.000 x 0,4545');
        $this->assertEqualsWithDelta(1040909.09, (float) $raw[19], 0.01, 'net item A eksak');

        // sheet Panduan menjelaskan pembagian biaya
        $guide = $ss->getSheetByName('Panduan')->toArray();
        $guideText = implode(' | ', array_map(fn ($r) => implode(' ', $r), $guide));
        $this->assertStringContainsString('PEMBAGIAN BIAYA', $guideText);
        $this->assertStringContainsString('proporsional', $guideText);
        $this->assertStringContainsString('PENGHASILAN BERSIH', $guideText);
        $this->assertStringContainsString('tanpa "Rp"', $guideText);
        $this->assertStringContainsString('order_number', $guideText);
        $this->assertStringContainsString('paid_at', $guideText);
        $this->assertStringContainsString('cod_fee_amount', $guideText);
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
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load(
            \Illuminate\Support\Facades\Storage::disk('imports')->path('exp2.xlsx')
        );
        $sheet = $ss->getSheetByName('Laporan Pesanan');
        $row = array_values(array_slice($sheet->toArray(null, true, true, true), 1, 1)[0]);

        $this->assertSame('Retur diproses (salah_ukuran)', $row[4]);
        $this->assertSame('0', $row[14], 'ongkir 0 tetap tampil');
        $this->assertSame('0', $row[15], 'subsidi 0 tetap tampil');
        $this->assertSame('0', $row[16], 'biaya COD 0 tetap tampil');
        $this->assertSame('0', $row[17], 'retur belum selesai = refund belum terjadi (0 tetap tampil 0)');
        $this->assertSame('0', $row[18], 'ongkir retur 0 tetap tampil');
        // tanpa biaya order, penghasilan bersih = harga produk
        $this->assertSame('500,000', $row[19]);
    }
}