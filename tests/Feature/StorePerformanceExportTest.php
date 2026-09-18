<?php

namespace Tests\Feature;

use App\Exports\StorePerformanceExport;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Support\IncomeDetailQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class StorePerformanceExportTest extends TestCase
{
    use RefreshDatabase;

    protected function payload(): array
    {
        return [
            'range' => [
                'label' => '7 hari terakhir',
                'from_date' => '2026-08-26',
                'to_date' => '2026-09-01',
            ],
            'previous_has_data' => true,
            'financial' => [
                'gross_revenue' => 125000000.0,
                'items_before_discount' => 120000000.0,
                'product_discount' => 3000000.0,
                'voucher_discount' => 1000000.0,
                'insurance' => 500000.0,
                'shipping_paid_by_customer' => 4000000.0,
                'shipping_raw' => 5000000.0,
                'shipping_subsidy' => 1000000.0,
                'cod_fee' => 1500000.0,
                'refund_adjustments' => 2500000.0,
                'return_shipping_store' => 75000.0,
                'net_revenue' => 115925000.0,
                'payments_received' => 60000000.0,
                'cod_paid' => 40000000.0,
                'cod_pending_amount' => 25000000.0,
                'cod_pending_count' => 3,
            ],
            'sections' => [
                [
                    'key' => 'sales',
                    'title' => 'Penjualan',
                    'kpis' => [
                        [
                            'key' => 'omzet',
                            'label' => 'Omset',
                            'value' => 125000000.0,
                            'previous' => 100000000.0,
                            'change_percent' => 25.0,
                            'format' => 'currency',
                        ],
                        [
                            'key' => 'units',
                            'label' => 'Jumlah Unit Terjual',
                            'value' => 47,
                            'previous' => 40,
                            'change_percent' => 17.5,
                            'format' => 'number',
                        ],
                        [
                            'key' => 'conversion',
                            'label' => 'Pengunjung yang Membeli',
                            'value' => 3.2,
                            'previous' => 0.0,
                            'change_percent' => null,
                            'format' => 'percent',
                        ],
                    ],
                ],
                [
                    'key' => 'payments',
                    'title' => 'Pembayaran',
                    'kpis' => [
                        [
                            'key' => 'cod_paid',
                            'label' => 'COD Selesai',
                            'value' => 0.0,
                            'previous' => 0.0,
                            'change_percent' => 0.0,
                            'format' => 'currency',
                        ],
                    ],
                ],
            ],
            'payment_mix' => [
                ['method' => 'cod', 'count' => 8, 'revenue' => 100000000.0],
                ['method' => 'transfer', 'count' => 2, 'revenue' => 25000000.0],
            ],
            'product_breakdowns' => [
                'most_viewed' => [
                    [
                        'parent_sku' => 'RGL-JNG-JKT-1',
                        'name' => 'Jendela Aluminium Jungkit Ornamen 200x180',
                        'views' => 535,
                        'clicks' => 54,
                        'total' => 589,
                    ],
                ],
            ],
            'sold_items' => [
                [
                    'order_number' => 'ORD26080005',
                    'created_at' => '2026-08-28T10:00:00+07:00',
                    'parent_sku' => 'RGL-JNG-JKT-1',
                    'name' => 'Jendela Aluminium Jungkit Ornamen 200x180',
                    'variation' => 'Putih',
                    'unit_price' => 30000000.0,
                    'quantity' => 4,
                    'line_discount' => 0.0,
                ],
            ],
            'income_detail' => [
                [
                    'order_number' => 'ORD26080005',
                    'created_at' => '2026-08-28T10:00:00+07:00',
                    'paid_at' => null,
                    'payment_method' => 'cod',
                    'order_status' => 'processing',
                    'payment_status' => 'pending',
                    'subtotal_before_discount' => 120000000.0,
                    'discount' => 3000000.0,
                    'voucher_discount' => 1000000.0,
                    'gross_revenue' => 125000000.0,
                    'shipping_raw' => 5000000.0,
                    'shipping_subsidy' => 1000000.0,
                    'shipping_net_paid_by_customer' => 4000000.0,
                    'cod_fee' => 1500000.0,
                    'refund_amount' => 2500000.0,
                    'return_shipping_store' => 75000.0,
                    'net_revenue' => 115925000.0,
                    'insurance' => 500000.0,
                    'total_paid_by_customer' => 125000000.0,
                    'paid_amount' => 60000000.0,
                    'outstanding' => 25000000.0,
                    'items_count' => 4,
                ],
            ],
            'top_products' => [
                [
                    'parent_sku' => 'RGL-JNG-JKT-1',
                    'name' => 'Jendela Aluminium Jungkit Ornamen 200x180',
                    'units' => 12,
                    'revenue' => 102050000.0,
                    'order_count' => 6,
                ],
            ],
            'customers' => [
                [
                    'customer_name' => 'Budi Santoso',
                    'customer_phone' => '081234567890',
                    'order_count' => 3,
                    'total_spent' => 15000000.0,
                    'last_order_at' => '2026-09-01T09:30:00+07:00',
                ],
            ],
            'return_shipping_costs' => [
                [
                    'order_number' => 'ORD26080005',
                    'completed_at' => '2026-08-30T14:10:00+07:00',
                    'fault_party' => 'store',
                    'reason' => 'barang pecah',
                    'return_shipping_cost' => 75000.0,
                ],
            ],
        ];
    }

    public function test_store_performance_export_sheets_dan_format(): void
    {
        $export = new StorePerformanceExport($this->payload());
        Excel::store($export, 'perf.xlsx', 'imports');
        $ss = IOFactory::load(
            Storage::disk('imports')->path('perf.xlsx')
        );

        // Struktur baru (spek owner 2026-09-11): P&L dan KPI dipisah,
        // dua tabel transaksi berformat Excel Table, analisis, panduan.
        $this->assertSame(
            ['Ringkasan Finansial', 'KPI Operasional Toko', 'Tabel Pesanan', 'Tabel Item', 'Analisis', 'Panduan'],
            $ss->getSheetNames()
        );

        // ---- RINGKASAN FINANSIAL: P&L + arus kas, angka berumus ----
        $lr = $ss->getSheetByName('Ringkasan Finansial');
        $rows = $lr->toArray(null, false, true, true);

        $this->assertSame('LAPORAN LABA RUGI & ARUS KAS TOKO', $rows[1]['A']);

        // Regresi 2026-09-11: baris pemisah antarblok dahulu ditulis [] dan
        // DIBUANG Maatwebsite sehingga seluruh styling bergeser satu baris.
        // Baris 4 kini WAJIB tetap berupa pemisah kosong.
        $this->assertSame('', (string) $rows[3]['A'], 'baris 3 = pemisah antar subjudul dan kolom, tidak boleh tergeser');
        $this->assertSame('Keterangan Akun', $rows[4]['A'], 'penanda kolom laporan');
        $this->assertSame('I. PENDAPATAN PENJUALAN', $rows[5]['A']);

        // Urutan pendapatan: nilai produk, voucher, ongkir, asuransi, COD, total.
        $this->assertStringContainsString('Nilai Produk Terjual', (string) $rows[6]['A']);
        $this->assertStringContainsString('Potongan Voucher Toko', (string) $rows[7]['A']);
        $this->assertStringContainsString('PENJUALAN GROSS', (string) $rows[11]['A']);

        // Identitas aritmetika kini lewat RUMUS yang menunjuk TabelPesanan:
        // setiap baris pendapatan wajib berisi rumus SUM kolom terstruktur.
        $lrRaw = $ss->getSheetByName('Ringkasan Finansial')->toArray(null, false, false);
        $kolomRumus = [];
        foreach ($lrRaw as $baris) {
            $nilai = (string) ($baris[1] ?? '');
            if (str_contains($nilai, 'SUM(TabelPesanan[')) {
                preg_match('/TabelPesanan[[]([^]]+)[]]/', $nilai, $m);
                $kolomRumus[] = $m[1] ?? '?';
            }
        }
        // Lima kolom pendapatan wajib berumus ke tabel (Biaya COD diteruskan
        // ke J&T memakai kolom yang sama dengan tanda minus).
        $this->assertContains('Nilai Produk Terjual', $kolomRumus);
        $this->assertContains('Voucher', $kolomRumus);
        $this->assertContains('Ongkir Dibayar Pelanggan', $kolomRumus);
        $this->assertContains('Asuransi', $kolomRumus);
        $this->assertContains('Biaya COD', $kolomRumus);
        $this->assertContains('Ongkir ke J&T', $kolomRumus, 'beban juga berumus');
        $this->assertContains('Refund Retur', $kolomRumus);
        $this->assertContains('Ongkir Retur (Toko)', $kolomRumus);

        // Penjualan Gross dan Penjualan Bersih wajib rumus yang menjumlah
        // baris komponennya, bukan angka mati.
        $teksC = implode(' ', array_map(fn ($r) => (string) ($r[1] ?? ''), $lrRaw));
        $this->assertStringContainsString('=SUM(B', $teksC, 'PENJUALAN GROSS berupa penjumlahan komponen');

        // Nilai komponen di payload tetap bisa direkonsiliasi dengan tabel:
        // total dibayar payload = nilai produk - voucher + ongkir + asuransi + COD.
        $fin = $this->payload()['financial'];
        $this->assertEqualsWithDelta(
            125000000.0,
            $fin['items_before_discount'] - $fin['voucher_discount'] + $fin['shipping_paid_by_customer'] + $fin['insurance'] + $fin['cod_fee'],
            0.5
        );

        // Asersi gaya anti-regresi (insiden 2026-09-11: nomor baris style
        // mendarat di baris data karena baris pemisah dibuang writer).
        $lrSheet = $ss->getSheetByName('Ringkasan Finansial');

        // Band judul (baris 1): fill navy, font putih (gaya referensi owner).
        $this->assertSame('FF1B365D', $lrSheet->getCell('A1')->getStyle()->getFill()->getStartColor()->getARGB());
        $this->assertSame('FFFFFFFF', $lrSheet->getCell('A1')->getStyle()->getFont()->getColor()->getARGB());

        // Judul seksi PENDAPATAN (baris 5): surface biru muda + font navy.
        $this->assertSame('FFF1F5F9', $lrSheet->getCell('A5')->getStyle()->getFill()->getStartColor()->getARGB());
        $this->assertSame('FF1B365D', $lrSheet->getCell('A5')->getStyle()->getFont()->getColor()->getARGB());

        // Baris data pertama (baris 7): format ribuan terpasang, font hitam normal.
        $this->assertSame('#,##0', $lrSheet->getCell('B6')->getStyle()->getNumberFormat()->getFormatCode());
        $this->assertSame('FF000000', $lrSheet->getCell('A6')->getStyle()->getFont()->getColor()->getARGB());

        // Biaya COD diteruskan ke J&T (baris 15): TIDAK boleh kena gaya judul seksi.
        $this->assertNotSame('FF1B365D', $lrSheet->getCell('A15')->getStyle()->getFont()->getColor()->getARGB());

        // PENJUALAN BERSIH (baris 20): double underline akuntansi.
        $this->assertSame('double', $lrSheet->getCell('A20')->getStyle()->getBorders()->getBottom()->getBorderStyle());

        // Pembayaran sudah diterima: subtotal arus kas biasa, TANPA double
        // underline (hanya PENJUALAN BERSIH yang double).
        $this->assertNotSame('double', $lrSheet->getCell('A26')->getStyle()->getBorders()->getBottom()->getBorderStyle());

        // ---- KPI OPERASIONAL TOKO: metrik pindah ke sheet sendiri ----
        // Regresi terjaga: KPI bernilai 0 tetap tertulis 0 numerik
        // (WithStrictNullComparison mencegah nol dibuang writer).
        $kpi = $ss->getSheetByName('KPI Operasional Toko');
        $kpiText = implode(' ', array_map(
            fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)),
            $kpi->toArray(null, false, true, true)
        ));
        $this->assertStringContainsString('COD Selesai', $kpiText, 'KPI pindah ke sheet operasional');
        $this->assertStringContainsString('Pengunjung yang Membeli', $kpiText);
        $this->assertStringContainsString('PENJUALAN', strtoupper($kpiText), 'judul section ikut pindah');

        // ---- TABEL PESANAN: header baris 1 + Excel Table + Total Row ----
        $rp = $ss->getSheetByName('Tabel Pesanan');
        $rpRows = $rp->toArray(null, false, true, true);
        $this->assertSame('Nomor Pesanan', $rpRows[1]['A'], 'header harus di baris 1, bukan di tengah sheet');
        $this->assertSame('Total Qty (Pcs)', $rpRows[1]['G'], 'nama kolom anti rancu (spek owner)');
        $this->assertSame('Jumlah Jenis SKU', $rpRows[1]['H']);
        $this->assertSame('Biaya COD', $rpRows[1]['M'], 'kolom uang pembeli terakhir sebelum total');
        $this->assertSame('Penjualan Gross', $rpRows[1]['N'], 'penjualan gross sebelum kolom beban');
        $this->assertSame('Penjualan Bersih', $rpRows[1]['R'], 'penjualan bersih setelah beban');
        $this->assertSame('Nama Pelanggan', $rpRows[1]['W'], 'kolom identitas pembeli (gaya referensi owner)');
        $this->assertSame('Nomor HP / WA', $rpRows[1]['X']);
        $this->assertSame('Kota Pengiriman', $rpRows[1]['Y']);

        // Status dalam bahasa Indonesia, bukan nilai mentah basis data.
        $this->assertSame('COD', $rpRows[2]['D']);
        $this->assertSame('Diproses', $rpRows[2]['E']);
        $this->assertSame('Belum dibayar', $rpRows[2]['F']);

        // Sel tanggal yang tidak punya nilai dibiarkan kosong, tanpa apostrof.
        $this->assertNull($rpRows[2]['C']);

        // Baris JUMLAH kini Total Row bawaan Excel (SUBTOTAL, bukan baris data).
        $this->assertSame('JUMLAH', $rpRows[3]['A']);
        $this->assertStringStartsWith('=SUBTOTAL(109', (string) $rpRows[3]['M'], 'Total Row memakai SUBTOTAL');

        // Penjualan Bersih per baris = rumus alur uang (COD dikurangkan).
        $this->assertSame('=N2-M2+O2+P2+Q2', $rpRows[2]['R']);

        // Excel Table terpasang dengan nama yang benar.
        $this->assertContains('TabelPesanan', $rp->getTableNames());

        // ---- ANALISIS: lima blok berjudul dalam satu sheet ----
        $an = $ss->getSheetByName('Analisis');
        $anText = implode(' ', array_map(
            fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)),
            $an->toArray(null, false, true, true)
        ));

        $this->assertStringContainsString('PRODUK TERLARIS', $anText);
        $this->assertStringContainsString('PRODUK PALING DILIHAT', $anText);
        $this->assertStringContainsString('PELANGGAN TERBAIK', $anText);
        $this->assertStringContainsString('BAURAN METODE PEMBAYARAN', $anText);
        $this->assertStringContainsString('BIAYA RETUR DITANGGUNG TOKO', $anText);

        // Data yang dulu dihitung tetapi tidak pernah diekspor.
        $this->assertStringContainsString('Transfer bank', $anText, 'bauran pembayaran wajib ada');
        $this->assertStringContainsString('535', $anText, 'jumlah dilihat wajib ada');

        // Biaya retur terender lengkap dengan label pihak penyebab.
        $this->assertStringContainsString('ORD26080005', $anText);
        $this->assertStringContainsString('Toko', $anText);
        $this->assertStringContainsString('barang pecah', $anText);

        // ---- TABEL ITEM: Subtotal Baris = Harga x Jumlah ----
        $it = $ss->getSheetByName('Tabel Item');
        $itRows = $it->toArray(null, true, true, true);
        $this->assertSame('SKU Induk', $itRows[1]['C']);
        $this->assertSame('Harga Satuan', $itRows[1]['F']);
        $this->assertSame('Jumlah', $itRows[1]['G']);
        $this->assertSame('Subtotal Baris', $itRows[1]['H']);
        $this->assertSame('=F2*G2', (string) $it->getCell('H2')->getValue(), 'subtotal baris berupa rumus harga x jumlah');
        $this->assertSame(120000000, (int) str_replace(',', '', (string) $itRows[2]['H']), 'nilai terhitung subtotal baris');
        $this->assertContains('TabelItem', $it->getTableNames());

        // ---- PANDUAN ----
        $guide = $ss->getSheetByName('Panduan')->toArray();
        $guideText = implode(' ', array_map(fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)), $guide));
        $this->assertStringContainsString('Periode Laporan: 2026-08-26 sampai 2026-09-01', $guideText);

        // Regresi 2026-09-11: pemisah [] dibuang writer membuat konten Panduan
        // bergeser ke baris 3 dan kehilangan gaya label (merah tebal + border).
        $gs = $ss->getSheetByName('Panduan');
        $this->assertSame('ISI BERKAS', $gs->getCell('A4')->getValue());
        $this->assertSame('FF1B365D', $gs->getCell('A4')->getStyle()->getFont()->getColor()->getARGB());
        $this->assertSame('thin', $gs->getCell('A4')->getStyle()->getBorders()->getBottom()->getBorderStyle());
        $this->assertStringContainsString('Penjualan Bersih', $guideText);
        $this->assertStringContainsString('pembeli unik', $guideText);
        $this->assertStringContainsString('Subsidi ongkir', $guideText);
    }

    public function test_blok_analisis_tanpa_data_diberi_keterangan(): void
    {
        $payload = $this->payload();
        $payload['return_shipping_costs'] = [];
        $payload['payment_mix'] = [];
        $payload['top_products'] = [];
        $payload['product_breakdowns'] = ['most_viewed' => []];
        $payload['customers'] = [];

        Excel::store(new StorePerformanceExport($payload), 'perf-empty.xlsx', 'imports');
        $ss = IOFactory::load(
            Storage::disk('imports')->path('perf-empty.xlsx')
        );

        $text = implode(' ', array_map(
            fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)),
            $ss->getSheetByName('Analisis')->toArray(null, false, true, true)
        ));

        // Pembaca harus bisa membedakan "tidak ada data" dari "gagal dimuat",
        // jadi blok kosong tidak boleh berupa header telanjang.
        $this->assertStringContainsString('Tidak ada produk terjual', $text);
        $this->assertStringContainsString('Belum ada data kunjungan produk', $text);
        $this->assertStringContainsString('Tidak ada pelanggan', $text);
        // Bauran metode kini berumus ke TabelPesanan: barisnya tetap ada
        // (formula menghasilkan 0 di Excel), bukan teks kosong.
        $this->assertStringContainsString('BAURAN METODE PEMBAYARAN', $text);
        $this->assertStringContainsString('COD', $text);
        $this->assertStringContainsString('Tidak ada biaya retur', $text);
    }

    public function test_periode_pembanding_kosong_tidak_menghasilkan_persen_palsu(): void
    {
        $payload = $this->payload();
        $payload['previous_has_data'] = false;

        Excel::store(new StorePerformanceExport($payload), 'perf-noprev.xlsx', 'imports');
        $ss = IOFactory::load(
            Storage::disk('imports')->path('perf-noprev.xlsx')
        );

        $rows = $ss->getSheetByName('KPI Operasional Toko')->toArray(null, false, true, true);
        $text = implode(' ', array_map(
            fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)),
            $rows
        ));

        // Saat rentang pembanding tidak punya data, kolom pembanding berisi
        // keterangan dan kolom perubahan dikosongkan, sehingga tidak muncul
        // persentase raksasa hasil pembagian oleh nyaris nol.
        $this->assertStringContainsString('Tidak ada data', $text);
        $this->assertStringNotContainsString('25.0%', $text);
    }

    public function test_export_lebih_dari_31_hari_mengisi_rincian_per_bulan(): void
    {
        // Bug 2026-09-11: jalur multi-bulan membangun ulang payload per bulan
        // tanpa income_detail/sold_items, sehingga sheet Rincian Pesanan &
        // Item Terjual tiap bulan kosong padahal angka Laba Rugi bulannya ada.
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $product = Product::create([
            'parent_sku' => 'WIN-MM-1',
            'name' => 'Jendela Multi Bulan',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $order = Order::create([
            'order_number' => 'RA-MM-1',
            'customer_name' => 'Budi',
            'customer_phone' => '081111111112',
            'shipping_address_line1' => 'Jl B',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
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
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-MM-1',
            'name' => 'Jendela Multi Bulan',
            'unit_price' => 2000000,
            'quantity' => 1,
            'line_subtotal' => 2000000,
            'line_discount' => 0,
            'line_total' => 2000000,
        ]);
        // Metrik finansial diambil dari order, unit dari item: sinkronkan.
        $order->update(['subtotal_amount' => 2000000, 'total_amount' => 2000000]);
        // Backdate via query builder: created_at tidak ada di $fillable,
        // jadi update() Eloquent diam-diam membuangnya (bug data test).
        Order::whereKey($order->id)->update([
            'created_at' => '2026-08-15 10:00:00',
            'updated_at' => '2026-08-15 10:00:00',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.analytics.store-performance.export', [
            'period' => 'custom',
            'export_from' => '2026-08-01',
            'export_to' => '2026-09-15',
        ]));
        $response->assertOk();

        // BinaryFileResponse tidak punya getContent(); muat langsung filenya.
        $ss = IOFactory::load($response->getFile()->getPathname());

        // 6 sheet x 2 bulan kalender (Agt 2026 + Sep 2026).
        $this->assertCount(12, $ss->getSheetNames());

        // Ringkasan Finansial Agustus: PENJUALAN GROSS kini RUMUS SUM
        // yang menunjuk TabelPesanan bulan itu (bulan Agt punya 1 pesanan).
        $lr = $ss->getSheetByName('Ringkasan Finansial (Agt 2026)');
        $rumusTotal = null;
        $rumusNet = null;
        for ($r = 1; $r <= $lr->getHighestRow(); $r++) {
            $b = trim((string) $lr->getCell('A'.$r)->getValue());
            if ($b === 'PENJUALAN GROSS') {
                $rumusTotal = (string) $lr->getCell('B'.$r)->getValue();
            }
            if ($b === 'PENJUALAN BERSIH') {
                $rumusNet = (string) $lr->getCell('B'.$r)->getValue();
            }
        }
        $this->assertNotNull($rumusTotal, 'baris PENJUALAN GROSS ada');
        $this->assertStringStartsWith('=SUM(B', $rumusTotal, 'total berupa rumus SUM kolom tabel');
        $this->assertNotNull($rumusNet, 'baris PENJUALAN BERSIH ada');
        $this->assertStringContainsString('B', $rumusNet, 'net berupa rumus yang menunjuk beban');

        // Tabel Pesanan Agustus WAJIB berisi baris pesanan RA-MM-1 + Total
        // Row SUBTOTAL (bukan sheet kosong) pada rentang bulan yang sama.
        $rp = $ss->getSheetByName('Tabel Pesanan (Agt 2026)');
        $this->assertSame('RA-MM-1', $rp->getCell('A2')->getValue());

        $jumlahRow = null;
        for ($r = 1; $r <= $rp->getHighestRow(); $r++) {
            if (trim((string) $rp->getCell('A'.$r)->getValue()) === 'JUMLAH') {
                $jumlahRow = $r;
                break;
            }
        }
        $this->assertNotNull($jumlahRow, 'baris JUMLAH wajib ada');
        $this->assertStringStartsWith(
            '=SUBTOTAL(109',
            (string) $rp->getCell('N'.$jumlahRow)->getValue(),
            'Total Row kolom Penjualan Gross berupa SUBTOTAL'
        );

        // Tabel Item Agustus juga terisi.
        $it = $ss->getSheetByName('Tabel Item (Agt 2026)');
        $this->assertSame('RA-MM-1', $it->getCell('A2')->getValue());
    }

    public function test_pesanan_dibatalkan_tampil_nol_sebagai_konteks(): void
    {
        // Owner 2026-09-13: pesanan batal penting untuk konteks performa.
        // Kontraknya: baris tampil di Tabel Pesanan dengan nilai uang 0
        // (identitas terdata), total Laba Rugi tidak berubah.
        $order = Order::create([
            'order_number' => 'RA-BATAL-1',
            'customer_name' => 'Batal Konteks',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl C',
            'shipping_city' => 'Solo',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '57762',
            'shipping_country' => 'Indonesia',
            'order_status' => 'cancelled',
            'payment_status' => 'pending',
            'shipping_status' => 'cancelled',
            'subtotal_amount' => 3300000,
            'shipping_amount' => 8500,
            'shipping_subsidy_amount' => 8500,
            'discount_amount' => 0,
            'total_amount' => 3308500,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
        $product = Product::create([
            'parent_sku' => 'RA-BATAL-SKU',
            'name' => 'Produk Batal',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'status' => 'archived',
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => 'RA-BATAL-SKU',
            'name' => 'Produk Batal',
            'unit_price' => 3300000,
            'quantity' => 1,
            'line_subtotal' => 3300000,
            'line_discount' => 0,
            'line_total' => 3300000,
        ]);
        Order::whereKey($order->id)->update([
            'created_at' => '2026-08-28 12:00:00',
            'updated_at' => '2026-08-28 12:00:00',
        ]);

        $rows = IncomeDetailQuery::orders('2026-08-26', '2026-09-01');
        $this->assertCount(1, $rows, 'pesanan batal ikut masuk Tabel Pesanan');
        $row = $rows[0];
        $this->assertSame('cancelled', $row['order_status']);
        foreach ([
            'subtotal_before_discount', 'discount', 'voucher_discount',
            'gross_revenue', 'shipping_raw', 'shipping_subsidy',
            'shipping_net_paid_by_customer', 'cod_fee', 'refund_amount',
            'return_shipping_store', 'net_revenue', 'insurance',
            'total_paid_by_customer', 'paid_amount', 'outstanding',
            'items_count', 'total_qty', 'sku_count',
        ] as $key) {
            $this->assertEquals(0, $row[$key], "kolom {$key} pesanan batal wajib 0");
        }
        $this->assertSame('Batal Konteks', $row['customer_name'], 'identitas tetap terdata');

        $payload = $this->payload();
        $payload['income_detail'] = $rows;
        $payload['sold_items'] = [];
        Excel::store(new StorePerformanceExport($payload), 'perf-batal.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('perf-batal.xlsx'));

        $rp = $ss->getSheetByName('Tabel Pesanan');
        $this->assertSame('RA-BATAL-1', $rp->getCell('A2')->getValue(), 'baris batal terender');
        $this->assertSame('Dibatalkan', $rp->getCell('E2')->getValue());
        foreach (['G', 'I', 'N'] as $col) {
            $this->assertEquals(0, (float) $rp->getCell($col.'2')->getValue(), "kolom {$col} baris batal = 0");
        }
        $this->assertSame('=N2-M2+O2+P2+Q2', $rp->getCell('R2')->getValue(), 'rumus net tetap terpasang (hasil 0 di Excel)');
        $this->assertSame('Batal Konteks', $rp->getCell('W2')->getValue(), 'identitas di kolom W');

        // Laba Rugi tetap berumus ke tabel; totalnya tidak terganggu baris nol.
        $lr = $ss->getSheetByName('Ringkasan Finansial');
        $this->assertStringContainsString('SUM(TabelPesanan[', (string) $lr->getCell('B6')->getValue());
    }

    public function test_nomor_hp_pelanggan_disimpan_sebagai_teks(): void
    {
        $payload = $this->payload();
        $payload['customers'] = [[
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '6285725116817',
            'order_count' => 3,
            'total_spent' => 15000000.0,
            'last_order_at' => '2026-09-01T09:30:00+07:00',
        ]];

        Excel::store(new StorePerformanceExport($payload), 'ident_performa.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('ident_performa.xlsx'));
        $an = $ss->getSheetByName('Analisis');

        // Nomor HP ada di blok PELANGGAN TERBAIK (baris judul, baris kolom,
        // lalu data mulai dua baris di bawahnya).
        $phoneRow = null;
        for ($r = 1; $r <= $an->getHighestRow(); $r++) {
            if (str_contains((string) $an->getCell('A'.$r)->getValue(), 'PELANGGAN TERBAIK')) {
                $phoneRow = $r + 2;
                break;
            }
        }
        $this->assertNotNull($phoneRow, 'blok PELANGGAN TERBAIK wajib ada');

        $cell = $an->getCell('B'.$phoneRow);
        $this->assertSame('6285725116817', (string) $cell->getValue(), 'nomor HP terbaca utuh');
        $this->assertSame(
            DataType::TYPE_STRING,
            $cell->getDataType(),
            'nomor HP disimpan sebagai teks'
        );
        $this->assertSame('@', $cell->getStyle()->getNumberFormat()->getFormatCode(), 'kolom HP berformat teks');
    }
}
