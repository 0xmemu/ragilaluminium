<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Kontrak export pesanan FORMAT TEMPLATE OWNER v3 (kontrak owner 2026-09-12):
 * 3 sheet (Skema A per item, Rekap per pesanan, Panduan & Kamus Lengkap),
 * rumus template utuh (N/P/Q/V/W/AA; SUMIF rekap; baris TOTAL O/P/Q saja),
 * Berat & Volume memakai format modul pengiriman (snapshot paket order).
 */
class OrderExportContractTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
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
        ], $overrides));
    }

    private function makeItem(Order $order, string $ps, string $vs, string $name, float $price, int $qty, float $lineDiscount, string $source = 'reg'): OrderItem
    {
        $prod = Product::create(['parent_sku' => $ps, 'name' => $name, 'category_id' => 1, 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'status' => 'archived']);
        $var = ProductVariant::create(['product_id' => $prod->id, 'variant_sku' => $vs, 'price' => $price, 'stock' => 5, 'weight_kg' => 1.0, 'status' => 'active']);

        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $prod->id,
            'product_variant_id' => $var->id,
            'parent_sku' => $ps,
            'variant_sku' => $vs,
            'name' => $name,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => $lineDiscount,
            'discount_source' => $source,
            'line_total' => ($price - $lineDiscount) * $qty,
        ]);
    }

    public function test_struktur_tiga_sheet_sesuai_template_v3(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $order = $this->makeOrder();
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 50000, 'flashsale');
        $this->makeItem($order, 'RA-B', 'RA-B-1', 'Pintu Sliding B', 750000, 2, 0);
        ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'JNT',
            'waybill_number' => 'RESI1234567890', 'shipping_cost' => 150000, 'status' => 'delivered',
        ]);

        Excel::store(new \App\Exports\OrderExport(Order::query()), 'exp.xlsx', 'imports');
        $ss = IOFactory::load(\Illuminate\Support\Facades\Storage::disk('imports')->path('exp.xlsx'));

        $this->assertSame(
            ['Laporan Transaksi (Skema A)', 'Rekap Keuangan per Pesanan', 'Panduan & Kamus Lengkap'],
            $ss->getSheetNames(),
            '3 sheet persis template owner v3'
        );

        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');
        // Baris 1 grup, baris 2 kolom (header TIDAK di tengah sheet).
        $this->assertSame('1. IDENTITAS PESANAN & WAKTU', $tx->getCell('A1')->getValue());
        $this->assertSame('7. DETAIL PELANGGAN & ALAMAT PENGIRIMAN (DI PALING AKHIR)', $tx->getCell('AB1')->getValue());
        $this->assertSame('Nomor Pesanan', $tx->getCell('A2')->getValue());
        $this->assertSame('Net Profit Toko (Kas Bersih)', $tx->getCell('AA2')->getValue());

        // 2 item = baris 3 dan 4; baris 5 TOTAL.
        $this->assertSame('ORD-EXP-001', $tx->getCell('A3')->getValue());
        $this->assertSame('RA-A-1', $tx->getCell('F3')->getValue());
        $this->assertSame('RESI1234567890', $tx->getCell('E3')->getValue());
        $this->assertSame('RA-B-1', $tx->getCell('F4')->getValue());
        $this->assertSame('TOTAL', $tx->getCell('A5')->getValue());

        // Harga normal = unit_price + line_discount (contoh sel owner).
        $this->assertEquals(1300000, (float) $tx->getCell('L3')->getValue());
        $this->assertEquals(50000, (float) $tx->getCell('M3')->getValue());
        $this->assertSame('Flashsale', $tx->getCell('K3')->getValue());
        $this->assertSame('Reguler', $tx->getCell('K4')->getValue());

        // Rumus template utuh per baris.
        $this->assertSame('=L3-M3', $tx->getCell('N3')->getValue());
        $this->assertSame('=M3*O3', $tx->getCell('P3')->getValue());
        $this->assertSame('=N3*O3', $tx->getCell('Q3')->getValue());
        $this->assertStringStartsWith('=IF(D3="Dibatalkan", 0, SUMIF($A$3:$A$4, A3, $Q$3:$Q$4)', (string) $tx->getCell('V3')->getValue());
        $this->assertSame('=(T3+S3)+U3', $tx->getCell('W3')->getValue());
        $this->assertSame('=IF(D3="Dibatalkan", 0 - Z3, V3-W3-Y3-Z3)', $tx->getCell('AA3')->getValue());

        // Kolom biaya level pesanan DIULANG per baris (header repeat) dengan
        // nilai pesanan penuh (bukan dibagi per unit lagi - aturan v3).
        $this->assertEquals(20000, (float) $tx->getCell('S3')->getValue());
        $this->assertEquals(20000, (float) $tx->getCell('S4')->getValue());
        $this->assertEquals(150000, (float) $tx->getCell('T3')->getValue());
        $this->assertEquals(5000, (float) $tx->getCell('U3')->getValue());

        // Baris TOTAL hanya O/P/Q ber-rumus; kolom pesanan = [Lihat Tab Rekap].
        $this->assertSame('=SUM(O3:O4)', $tx->getCell('O5')->getValue());
        $this->assertSame('=SUM(P3:P4)', $tx->getCell('P5')->getValue());
        $this->assertSame('=SUM(Q3:Q4)', $tx->getCell('Q5')->getValue());
        $this->assertSame('[Lihat Tab Rekap]', $tx->getCell('R5')->getValue());
        $this->assertSame('[Lihat Tab Rekap]', $tx->getCell('V5')->getValue());
        $this->assertSame('[Lihat Tab Rekap]', $tx->getCell('AA5')->getValue());
        $this->assertNull($tx->getCell('AB5')->getValue(), 'kolom pelanggan di baris TOTAL kosong');

        // No. Telepon & Kode Pos ditulis TEXT (aturan Panduan 27/30).
        $this->assertSame('081234567890', $tx->getCell('AC3')->getValue());
        $this->assertSame('53411', (string) $tx->getCell('AI3')->getValue(), 'kode pos terbaca utuh');
    }

    public function test_rekap_per_pesanan_dengan_sumif_lintas_sheet(): void
    {
        $order = $this->makeOrder(['voucher_discount_amount' => 100000]);
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 50000);
        $this->makeItem($order, 'RA-B', 'RA-B-1', 'Pintu Sliding B', 750000, 2, 0);

        Excel::store(new \App\Exports\OrderExport(Order::query()), 'exp2.xlsx', 'imports');
        $ss = IOFactory::load(\Illuminate\Support\Facades\Storage::disk('imports')->path('exp2.xlsx'));
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');

        $this->assertSame('1. IDENTITAS PESANAN', $rk->getCell('A1')->getValue());
        $this->assertSame('Nomor Pesanan', $rk->getCell('A2')->getValue());
        $this->assertSame('NET PROFIT TOKO (KAS BERSIH)', $rk->getCell('R2')->getValue());

        $this->assertSame('ORD-EXP-001', $rk->getCell('A3')->getValue());
        $this->assertSame('=F3+G3', $rk->getCell('E3')->getValue());
        $this->assertStringStartsWith("=SUMIF('Laporan Transaksi (Skema A)'!\$A\$3:\$A\$4, A3,", (string) $rk->getCell('F3')->getValue());
        $this->assertStringContainsString("\$Q\$3:\$Q\$4)", (string) $rk->getCell('G3')->getValue());
        $this->assertEquals(100000, (float) $rk->getCell('H3')->getValue());
        $this->assertSame('=IF(D3="Dibatalkan", 0, G3-H3+J3+K3)', $rk->getCell('L3')->getValue());
        $this->assertSame('=I3+J3', $rk->getCell('M3')->getValue());
        $this->assertSame('=K3', $rk->getCell('N3')->getValue());
        $this->assertSame('=M3+N3', $rk->getCell('O3')->getValue());
        $this->assertSame('=IF(D3="Dibatalkan", 0 - Q3, L3-O3-P3-Q3)', $rk->getCell('R3')->getValue());

        // Baris TOTAL menjumlah E:R (satu baris per pesanan, aman di-SUM).
        $this->assertSame('TOTAL', $rk->getCell('A4')->getValue());
        $this->assertSame('=SUM(E3:E3)', $rk->getCell('E4')->getValue());
        $this->assertSame('=SUM(R3:R3)', $rk->getCell('R4')->getValue());
    }

    public function test_berat_volume_pakai_format_pengiriman_snapshot(): void
    {
        $order = $this->makeOrder([
            'shipping_chargeable_weight_kg' => 22.453,
            'shipping_package_snapshot' => [
                'length_cm' => 126.0, 'width_cm' => 66.0, 'height_cm' => 13.5,
                'chargeable_weight_kg' => 22.453, 'packing_source' => 'catalog_default',
            ],
        ]);
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Produk Snapshot', 1000000, 1, 0);

        // Order kedua TANPA snapshot (lama) -> berat & volume "-".
        $lama = $this->makeOrder(['order_number' => 'ORD-EXP-LAMA']);
        $this->makeItem($lama, 'RA-B', 'RA-B-1', 'Produk Lama', 500000, 1, 0);

        Excel::store(new \App\Exports\OrderExport(Order::query()), 'exp3.xlsx', 'imports');
        $ss = IOFactory::load(\Illuminate\Support\Facades\Storage::disk('imports')->path('exp3.xlsx'));
        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');

        $rows = [];
        foreach ([$tx->getCell('A3')->getValue(), $tx->getCell('A4')->getValue()] as $i => $num) {
            $r = $i + 3;
            $rows[$num] = [
                'kg' => $tx->getCell("I{$r}")->getValue(),
                'vol' => $tx->getCell("J{$r}")->getValue(),
            ];
        }

        // Snapshot ada -> berat tagih pengiriman (kg) + dimensi luar paket.
        $this->assertEqualsWithDelta(22.45, (float) $rows['ORD-EXP-001']['kg'], 0.01);
        $this->assertSame('126 x 66 x 14 cm', $rows['ORD-EXP-001']['vol']);
        // Snapshot tidak ada -> "-" (tidak dihitung retroaktif).
        $this->assertSame('-', $rows['ORD-EXP-LAMA']['kg']);
        $this->assertSame('-', $rows['ORD-EXP-LAMA']['vol']);
    }

    public function test_status_dibatalkan_dan_retur_berlabel_indonesia(): void
    {
        $batal = $this->makeOrder([
            'order_number' => 'ORD-EXP-BATAL',
            'order_status' => 'cancelled',
        ]);
        $this->makeItem($batal, 'RA-X', 'RA-X-1', 'Produk X', 400000, 1, 0);

        $retur = $this->makeOrder([
            'order_number' => 'ORD-EXP-RETUR',
            'order_status' => 'return_in_process',
        ]);
        $item = $this->makeItem($retur, 'RA-Y', 'RA-Y-1', 'Produk Y', 500000, 1, 0);
        $case = new OrderReturnCase([
            'status' => 'completed', 'reason' => 'pecah', 'resolution_type' => 'refund',
            'refund_amount' => 300000, 'additional_shipping_amount' => 25000,
        ]);
        $case->order_id = $retur->id;
        $case->save();

        Excel::store(new \App\Exports\OrderExport(Order::query()), 'exp4.xlsx', 'imports');
        $ss = IOFactory::load(\Illuminate\Support\Facades\Storage::disk('imports')->path('exp4.xlsx'));
        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');

        // Urutan template: pesanan terbaru dulu.
        $this->assertSame('ORD-EXP-RETUR', $tx->getCell('A3')->getValue());
        $this->assertSame('Retur diproses', $tx->getCell('D3')->getValue());
        $this->assertSame('Refund (pecah)', $tx->getCell('X3')->getValue());
        $this->assertEquals(300000, (float) $tx->getCell('Y3')->getValue());
        $this->assertEquals(25000, (float) $tx->getCell('Z3')->getValue());
        $this->assertSame('ORD-EXP-BATAL', $tx->getCell('A4')->getValue());
        $this->assertSame('Dibatalkan', $tx->getCell('D4')->getValue());
        $this->assertSame('Pesanan dibatalkan', $tx->getCell('X4')->getValue());

        // Status mentah DB tidak pernah tampil.
        $grid = json_encode($tx->toArray(null, true, false));
        $this->assertStringNotContainsString('return_in_process', $grid);
    }

    public function test_panduan_memuat_kamus_owner_dan_sumber_berat(): void
    {
        Excel::store(new \App\Exports\OrderExport(Order::query()), 'exp5.xlsx', 'imports');
        $ss = IOFactory::load(\Illuminate\Support\Facades\Storage::disk('imports')->path('exp5.xlsx'));
        $guide = $ss->getSheetByName('Panduan & Kamus Lengkap')->toArray();
        $text = implode(' | ', array_map(fn ($r) => implode(' ', (array) $r), $guide));

        $this->assertStringContainsString('KAMUS KOLOM', $text);
        $this->assertStringContainsString('25. Net Profit Toko', $text);
        $this->assertStringContainsString('31. Prinsip COD & Ongkir (Pass-Through)', $text);
        $this->assertStringContainsString('32. Aturan Agregasi', $text);
        $this->assertStringContainsString('berat tagih paket', $text);
        $this->assertStringContainsString('P x L x T / 5000', $text);
        $this->assertStringNotContainsString('—', $text);
        $this->assertStringNotContainsString('–', $text);
    }
}
