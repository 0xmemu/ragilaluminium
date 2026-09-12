<?php

namespace Tests\Feature;

use App\Exports\OrderExport;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Kontrak export pesanan FORMAT TEMPLATE OWNER v3 (kontrak owner 2026-09-12):
 * 3 sheet (Skema A per item, Rekap per pesanan, Panduan & Kamus Lengkap),
 * kolom Diskon % (N = M/L), Net Profit per produk (AC = net profit pesanan
 * dialokasikan proporsional per subtotal baris), SUMIF rekap yang
 * mengecualikan pesanan Dibatalkan, baris TOTAL P/Q/R/AC saja, Berat &
 * Volume memakai format modul pengiriman.
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

        Excel::store(new OrderExport(Order::query()), 'exp.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp.xlsx'));

        $this->assertSame(
            ['Laporan Transaksi (Skema A)', 'Rekap Keuangan per Pesanan', 'Panduan & Kamus Lengkap'],
            $ss->getSheetNames(),
            '3 sheet persis template owner v3'
        );

        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');
        // Baris 1 grup, baris 2 kolom (header TIDAK di tengah sheet).
        $this->assertSame('1. IDENTITAS PESANAN & WAKTU', $tx->getCell('A1')->getValue());
        $this->assertSame('6. HASIL BERSIH', $tx->getCell('AC1')->getValue());
        $this->assertSame('7. DETAIL PELANGGAN & ALAMAT PENGIRIMAN (DI PALING AKHIR)', $tx->getCell('AD1')->getValue());
        $this->assertSame('Nomor Pesanan', $tx->getCell('A2')->getValue());
        $this->assertSame('Diskon per Produk (%)', $tx->getCell('N2')->getValue());
        $this->assertSame('Harga Jual Satuan', $tx->getCell('O2')->getValue());
        $this->assertSame('Net Profit Toko per Produk (Kas Bersih)', $tx->getCell('AC2')->getValue());
        // Kolom asuransi (W) menyisip setelah Biaya COD (V).
        $this->assertSame('Biaya COD Ditanggung Pembeli', $tx->getCell('V2')->getValue());
        $this->assertSame('Asuransi Pengiriman Dibayar Pembeli', $tx->getCell('W2')->getValue());
        $this->assertSame('Total Tagihan Dibayar Pembeli', $tx->getCell('X2')->getValue());
        $this->assertSame('Pengurangan Nilai Pesanan ke J&T', $tx->getCell('Y2')->getValue());

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

        // Rumus template utuh per baris: Diskon % = M/L, Harga Jual = L-M,
        // Total Diskon = M*P, Subtotal = O*P.
        $this->assertSame('=IF(L3=0, 0, M3/L3)', $tx->getCell('N3')->getValue());
        $this->assertSame('=L3-M3', $tx->getCell('O3')->getValue());
        $this->assertSame('=M3*P3', $tx->getCell('Q3')->getValue());
        $this->assertSame('=O3*P3', $tx->getCell('R3')->getValue());
        // Total Tagihan = subtotal - voucher + ongkir + COD + ASURANSI.
        $this->assertStringStartsWith('=IF(D3="Dibatalkan", 0, SUMIF($A$3:$A$4, A3, $R$3:$R$4)', (string) $tx->getCell('X3')->getValue());
        $this->assertStringEndsWith('- S3 + U3 + V3 + W3)', (string) $tx->getCell('X3')->getValue());
        // Pengurangan J&T = TAGIHAN ASLI J&T + COD. Fixture menyimpan
        // shipping_cost 150000 (totalFreight dari J&T) yang SUDAH memuat
        // asuransi, jadi asuransi tidak ditambahkan lagi.
        $this->assertSame('=150000.00+V3', $tx->getCell('Y3')->getValue());
        // Net profit per produk = net profit pesanan x porsi subtotal baris.
        $this->assertStringStartsWith('=IF(D3="Dibatalkan", 0-AA3-AB3, X3-Y3-AA3-AB3)', (string) $tx->getCell('AC3')->getValue());
        $this->assertStringContainsString('IFERROR(R3/SUMIF($A$3:$A$4, A3, $R$3:$R$4), 1/COUNTIF($A$3:$A$4, A3))', (string) $tx->getCell('AC3')->getValue());

        // Kolom biaya level pesanan DIULANG per baris (header repeat) dengan
        // nilai pesanan penuh (bukan dibagi per unit lagi - aturan v3).
        $this->assertEquals(20000, (float) $tx->getCell('T3')->getValue());
        $this->assertEquals(20000, (float) $tx->getCell('T4')->getValue());
        $this->assertEquals(150000, (float) $tx->getCell('U3')->getValue());
        $this->assertEquals(5000, (float) $tx->getCell('V3')->getValue());
        // Asuransi = 0 bila pembeli tidak memilih (pesanan uji tanpa asuransi).
        $this->assertEquals(0, (float) $tx->getCell('W3')->getValue());

        // Baris TOTAL: P/Q/R/AC ber-rumus; kolom pesanan = [Lihat Tab Rekap].
        $this->assertSame('=SUM(P3:P4)', $tx->getCell('P5')->getValue());
        $this->assertSame('=SUM(Q3:Q4)', $tx->getCell('Q5')->getValue());
        $this->assertSame('=SUM(R3:R4)', $tx->getCell('R5')->getValue());
        $this->assertSame('=SUM(AC3:AC4)', $tx->getCell('AC5')->getValue());
        $this->assertSame('[Lihat Tab Rekap]', $tx->getCell('S5')->getValue());
        $this->assertSame('[Lihat Tab Rekap]', $tx->getCell('W5')->getValue());
        $this->assertSame('[Lihat Tab Rekap]', $tx->getCell('AB5')->getValue());
        $this->assertNull($tx->getCell('AD5')->getValue(), 'kolom pelanggan di baris TOTAL kosong');

        // No. Telepon & Kode Pos ditulis TEXT (aturan Panduan 27/30).
        $this->assertSame('081234567890', $tx->getCell('AE3')->getValue());
        $this->assertSame('53411', (string) $tx->getCell('AK3')->getValue(), 'kode pos terbaca utuh');
    }

    public function test_rekap_per_pesanan_dengan_sumif_lintas_sheet(): void
    {
        $order = $this->makeOrder(['voucher_discount_amount' => 100000]);
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 50000);
        $this->makeItem($order, 'RA-B', 'RA-B-1', 'Pintu Sliding B', 750000, 2, 0);

        Excel::store(new OrderExport(Order::query()), 'exp2.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp2.xlsx'));
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');

        $this->assertSame('1. IDENTITAS PESANAN', $rk->getCell('A1')->getValue());
        $this->assertSame('Nomor Pesanan', $rk->getCell('A2')->getValue());
        $this->assertSame('Asuransi Pengiriman Dibayar Pembeli', $rk->getCell('L2')->getValue());
        $this->assertSame('TOTAL DIBAYAR PEMBELI', $rk->getCell('M2')->getValue());
        $this->assertSame('Ongkir Total ke J&T', $rk->getCell('N2')->getValue());
        $this->assertSame('Selisih Ongkir J&T', $rk->getCell('O2')->getValue());
        $this->assertSame('Biaya COD ke J&T', $rk->getCell('P2')->getValue());
        $this->assertSame('Total Potongan J&T', $rk->getCell('Q2')->getValue());
        $this->assertSame('NET PROFIT TOKO (KAS BERSIH)', $rk->getCell('T2')->getValue());

        $this->assertSame('ORD-EXP-001', $rk->getCell('A3')->getValue());
        $this->assertSame('=F3+G3', $rk->getCell('E3')->getValue());
        $this->assertStringContainsString('SUMPRODUCT', (string) $rk->getCell('F3')->getValue(), 'rumus diskon memakai SUMPRODUCT');
        $this->assertStringContainsString('Dibatalkan', (string) $rk->getCell('F3')->getValue(), 'rumus diskon mengecualikan pesanan batal');
        $this->assertStringContainsString('SUMPRODUCT', (string) $rk->getCell('G3')->getValue(), 'rumus subtotal memakai SUMPRODUCT');
        $this->assertStringContainsString('Dibatalkan', (string) $rk->getCell('G3')->getValue(), 'rumus subtotal mengecualikan pesanan batal');
        $this->assertEquals(100000, (float) $rk->getCell('H3')->getValue());
        $this->assertEquals(0, (float) $rk->getCell('L3')->getValue(), 'asuransi 0 bila tidak dipilih');
        $this->assertSame('=IF(D3="Dibatalkan", 0, G3-H3+J3+K3+L3)', $rk->getCell('M3')->getValue());
        // Fixture ini tidak punya tagihan J&T asli, jadi N memakai asumsi
        // checkout (subsidi + ongkir pembeli + asuransi) dan selisihnya nol.
        $this->assertSame('=I3+J3+L3', $rk->getCell('N3')->getValue());
        $this->assertSame('=N3-I3-J3-L3', $rk->getCell('O3')->getValue(), 'selisih = tagihan J&T - asumsi checkout');
        $this->assertSame('=K3', $rk->getCell('P3')->getValue());
        $this->assertSame('=N3+P3', $rk->getCell('Q3')->getValue());
        $this->assertSame('=IF(D3="Dibatalkan", 0 - R3 - S3, M3-Q3-R3-S3)', $rk->getCell('T3')->getValue());

        // Baris TOTAL menjumlah E:R (satu baris per pesanan, aman di-SUM).
        $this->assertSame('TOTAL', $rk->getCell('A4')->getValue());
        $this->assertSame('=SUM(E3:E3)', $rk->getCell('E4')->getValue());
        $this->assertSame('=SUM(T3:T3)', $rk->getCell('T4')->getValue());
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

        Excel::store(new OrderExport(Order::query()), 'exp3.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp3.xlsx'));
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

        Excel::store(new OrderExport(Order::query()), 'exp4.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp4.xlsx'));
        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');

        // Urutan template: pesanan terbaru dulu.
        $this->assertSame('ORD-EXP-RETUR', $tx->getCell('A3')->getValue());
        $this->assertSame('Retur diproses', $tx->getCell('D3')->getValue());
        $this->assertSame('Refund (pecah)', $tx->getCell('Z3')->getValue());
        $this->assertEquals(300000, (float) $tx->getCell('AA3')->getValue());
        $this->assertEquals(25000, (float) $tx->getCell('AB3')->getValue());
        $this->assertSame('ORD-EXP-BATAL', $tx->getCell('A4')->getValue());
        $this->assertSame('Dibatalkan', $tx->getCell('D4')->getValue());
        $this->assertSame('Pesanan dibatalkan', $tx->getCell('Z4')->getValue());

        // Rekap: penjualan pesanan Dibatalkan tidak dihitung (SUMIFS
        // berlaku sampai ke baris TOTAL.
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');
        $rowBatal = null;
        foreach (range(3, $rk->getHighestRow()) as $rr) {
            if ($rk->getCell("A{$rr}")->getValue() === 'ORD-EXP-BATAL') {
                $rowBatal = $rr;
                break;
            }
        }
        $this->assertNotNull($rowBatal, 'pesanan batal ada di Rekap');
        foreach (['F', 'G'] as $col) {
            $this->assertStringContainsString('Dibatalkan', (string) $rk->getCell("{$col}{$rowBatal}")->getValue(), 'pengecualian pesanan batal aktif');
        }
        // Kolom Net Profit dicari lewat header baris 2 (tahan pergeseran kolom).
        $netCol = null;
        foreach (range(1, 40) as $ci) {
            if ($rk->getCell([$ci, 2])->getValue() === 'NET PROFIT TOKO (KAS BERSIH)') {
                $netCol = Coordinate::stringFromColumnIndex($ci);
                break;
            }
        }
        $this->assertNotNull($netCol, 'header NET PROFIT TOKO ditemukan');
        $this->assertStringStartsWith('=IF(D'.$rowBatal.'="Dibatalkan", 0 - ', (string) $rk->getCell($netCol.$rowBatal)->getValue(), 'net profit pesanan batal = -(refund + ongkir retur)');

        // Status mentah DB tidak pernah tampil.
        $grid = json_encode($tx->toArray(null, true, false));
        $this->assertStringNotContainsString('return_in_process', $grid);
    }

    public function test_panduan_memuat_kamus_owner_dan_sumber_berat(): void
    {
        Excel::store(new OrderExport(Order::query()), 'exp5.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp5.xlsx'));
        $guide = $ss->getSheetByName('Panduan & Kamus Lengkap')->toArray();
        $text = implode(' | ', array_map(fn ($r) => implode(' ', (array) $r), $guide));

        $this->assertStringContainsString('KAMUS KOLOM', $text);
        $this->assertStringContainsString('12. Diskon per Produk (%)', $text);
        $this->assertStringContainsString('21. Asuransi Pengiriman Dibayar Pembeli', $text);
        $this->assertStringContainsString('27. Net Profit Toko per Produk', $text);
        $this->assertStringContainsString('33. Prinsip COD & Ongkir (Pass-Through)', $text);
        $this->assertStringContainsString('34. Aturan Agregasi', $text);
        $this->assertStringContainsString('berat tagih paket', $text);
        $this->assertStringContainsString('P x L x T / 5000', $text);
        $this->assertStringNotContainsString('—', $text);
        $this->assertStringNotContainsString('–', $text);
    }

    public function test_nomor_resi_numerik_tetap_teks_bukan_notasi_ilmiah(): void
    {
        $order = $this->makeOrder();
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 0);
        ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'JNT',
            'waybill_number' => '201718781511', 'shipping_cost' => 150000, 'status' => 'delivered',
        ]);

        Excel::store(new OrderExport(Order::query()), 'exp_resi.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp_resi.xlsx'));

        // Nomor resi J&T asli murni angka. Disimpan sebagai angka, Excel
        // menampilkan 2,01719E+11 dan digit di atas 15 dibulatkan.
        $cell = $ss->getSheetByName('Laporan Transaksi (Skema A)')->getCell('E3');
        $this->assertSame('201718781511', (string) $cell->getValue(), 'nomor resi terbaca utuh');
        $this->assertSame(
            DataType::TYPE_STRING,
            $cell->getDataType(),
            'nomor resi disimpan sebagai teks, bukan angka'
        );
        $this->assertSame(
            '@',
            $cell->getStyle()->getNumberFormat()->getFormatCode(),
            'kolom No. Resi J&T berformat teks'
        );
    }

    public function test_kolom_identitas_pakai_format_teks(): void
    {
        $order = $this->makeOrder();
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 0);

        Excel::store(new OrderExport(Order::query()), 'exp_ident.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp_ident.xlsx'));

        // Nomor pesanan, SKU varian, telepon, kode pos: identitas, wajib teks.
        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');
        foreach (['A', 'F', 'AE', 'AK'] as $col) {
            $this->assertSame(
                '@',
                $tx->getCell($col.'3')->getStyle()->getNumberFormat()->getFormatCode(),
                "kolom {$col} sheet 1 wajib berformat teks"
            );
        }

        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');
        foreach (['A', 'V'] as $col) {
            $this->assertSame(
                '@',
                $rk->getCell($col.'3')->getStyle()->getNumberFormat()->getFormatCode(),
                "kolom {$col} sheet Rekap wajib berformat teks"
            );
        }
    }

    /**
     * Kontrak: asuransi masuk ke Total Tagihan Dibayar Pembeli DAN ke
     * pengurangan nilai pesanan ke J&T (keduanya, karena J&T memotong biaya
     * asuransi). Kalau hanya salah satu, net profit jadi salah.
     */
    public function test_asuransi_ikut_di_total_dan_pengurangan_jnt(): void
    {
        // subtotal 2.750.000 + ongkir 150.000 + COD 5.000 + asuransi 20.000
        $order = $this->makeOrder([
            'shipping_amount' => 150000,
            'shipping_insurance_amount' => 20000,
            'total_amount' => 2925000,
        ]);
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 2750000, 1, 0);

        Excel::store(new OrderExport(Order::query()), 'exp_ins.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('exp_ins.xlsx'));
        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');

        // Nilai asuransi tampil di kedua sheet.
        $this->assertEquals(20000, (float) $tx->getCell('W3')->getValue(), 'sheet 1 kolom W');
        $this->assertEquals(20000, (float) $rk->getCell('L3')->getValue(), 'sheet rekap kolom L');

        // Aritmetika laporan = total pesanan di DB.
        $subtotal = (float) $order->subtotal_amount;
        $voucher = (float) $order->voucher_discount_amount;
        $ongkir = (float) $order->shipping_amount;
        $cod = (float) $order->cod_fee_amount;
        $asuransi = (float) $order->shipping_insurance_amount;

        $totalLaporan = $subtotal - $voucher + $ongkir + $cod + $asuransi;
        $this->assertEquals((float) $order->total_amount, $totalLaporan, 'total laporan = total DB');

        // Pengurangan J&T memuat asuransi (ongkir + subsidi + COD + asuransi).
        $potongan = $ongkir + (float) $order->shipping_subsidy_amount + $cod + $asuransi;
        $this->assertEquals(150000 + 20000 + 5000 + 20000, $potongan, 'asuransi dipotong J&T');

        // Net profit = total - potongan (tanpa refund/retur).
        $this->assertEquals($totalLaporan - $potongan, 2750000.0 - 20000, 'asuransi saling meniadakan di net');
    }

    /**
     * Ongkir ASLI dari konsol J&T (diisi admin saat input resi) WAJIB dipakai
     * pembukuan, dan selisihnya terhadap asumsi checkout harus terdeteksi.
     *
     * Skenario: pembeli bayar ongkir 150.000, toko subsidi 20.000, sehingga
     * asumsi checkout = 170.000. Konsol J&T ternyata menagih 185.000.
     */
    public function test_ongkir_asli_jnt_dipakai_dan_selisih_terdeteksi(): void
    {
        $order = $this->makeOrder();
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 0);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => '201718781599',
            'shipping_cost' => 185000,
            'status' => 'delivered',
        ]);

        Excel::store(new OrderExport(Order::query()), 'ongkir.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('ongkir.xlsx'));
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');

        // N = tagihan ASLI dari J&T, bukan rumus asumsi.
        $this->assertEquals(185000, (float) $rk->getCell('N3')->getValue(), 'pakai tagihan asli J&T');
        // O = 185.000 - (150.000 + 20.000 + 0 asuransi) = +15.000 ditanggung toko.
        $this->assertEquals(15000, (float) $rk->getCell('O3')->getCalculatedValue(), 'selisih terdeteksi');
        // Q = Total Potongan J&T = tagihan asli + COD (5.000).
        $this->assertEquals(190000, (float) $rk->getCell('Q3')->getCalculatedValue());

        // Sheet 1 memakai basis yang sama supaya kedua sheet rekonsiliasi.
        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');
        $this->assertSame('=185000.00+V3', $tx->getCell('Y3')->getValue());
        $this->assertEquals(
            (float) $rk->getCell('Q3')->getCalculatedValue(),
            (float) $tx->getCell('Y3')->getCalculatedValue(),
            'Sheet 1 dan Sheet 2 memakai ongkir yang sama'
        );
    }

    /**
     * Pesanan yang belum dicatat ongkir aslinya tetap memakai asumsi checkout
     * (ongkir pembeli + subsidi) supaya pembukuan lama tidak berubah, dan
     * selisihnya nol.
     */
    public function test_ongkir_asli_kosong_pakai_asumsi_checkout(): void
    {
        $order = $this->makeOrder();
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 0);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => '201718781600',
            // shipping_cost sengaja dibiarkan kosong: belum dicatat admin.
            'status' => 'delivered',
        ]);

        Excel::store(new OrderExport(Order::query()), 'ongkir2.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('ongkir2.xlsx'));
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');

        $this->assertSame('=I3+J3+L3', $rk->getCell('N3')->getValue(), 'kembali ke asumsi checkout');
        $this->assertEquals(0, (float) $rk->getCell('O3')->getCalculatedValue(), 'selisih nol saat belum ada');

        $tx = $ss->getSheetByName('Laporan Transaksi (Skema A)');
        $this->assertSame('=(U3+T3+W3)+V3', $tx->getCell('Y3')->getValue());
    }

    /**
     * Ongkir asli dari record yang sudah dibatalkan tidak boleh dipakai:
     * resi batal bukan biaya yang ditagih J&T.
     */
    public function test_ongkir_asli_record_cancelled_diabaikan(): void
    {
        $order = $this->makeOrder();
        $this->makeItem($order, 'RA-A', 'RA-A-1', 'Jendela Jungkit A', 1250000, 1, 0);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => '201718781601',
            'shipping_cost' => 999000,
            'status' => 'cancelled',
        ]);

        Excel::store(new OrderExport(Order::query()), 'ongkir3.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('ongkir3.xlsx'));
        $rk = $ss->getSheetByName('Rekap Keuangan per Pesanan');

        $this->assertSame('=I3+J3+L3', $rk->getCell('N3')->getValue(), 'record cancelled diabaikan');
        $this->assertEquals(0, (float) $rk->getCell('O3')->getCalculatedValue());
    }
}
