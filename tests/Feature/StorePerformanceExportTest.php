<?php

namespace Tests\Feature;

use App\Exports\StorePerformanceExport;
use App\Models\User;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
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
                            'label' => 'COD Dibayar',
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
            \Illuminate\Support\Facades\Storage::disk('imports')->path('perf.xlsx')
        );

        // Empat sheet data + panduan. Sheet analisis menggabungkan produk,
        // pelanggan, bauran pembayaran, dan biaya retur.
        $this->assertSame(
            ['Laba Rugi', 'Rincian Pesanan', 'Item Terjual', 'Analisis', 'Panduan'],
            $ss->getSheetNames()
        );

        // ---- LABA RUGI: laporan bertingkat ----
        $lr = $ss->getSheetByName('Laba Rugi');
        $rows = $lr->toArray(null, true, true, true);

        $this->assertSame('LAPORAN LABA RUGI TOKO', $rows[1]['B']);

        // Regresi 2026-09-11: baris pemisah antarblok dahulu ditulis [] dan
        // DIBUANG Maatwebsite sehingga seluruh styling bergeser satu baris.
        // Baris 4 kini WAJIB tetap berupa pemisah kosong.
        $this->assertSame('', (string) $rows[4]['B'], 'baris 4 = pemisah antar judul dan kolom, tidak boleh tergeser');
        $this->assertSame('Keterangan', $rows[5]['B'], 'penanda kolom laporan');
        $this->assertSame('PENDAPATAN', $rows[6]['B']);

        // Urutan pendapatan: nilai produk, voucher, ongkir, asuransi, COD, total.
        $this->assertStringContainsString('Nilai produk terjual', (string) $rows[7]['B']);
        $this->assertStringContainsString('Potongan voucher', (string) $rows[8]['B']);
        $this->assertStringContainsString('TOTAL DIBAYAR PEMBELI', (string) $rows[12]['B']);

        $raw = $lr->toArray(null, true, false);

        // Identitas aritmetika: komponen pendapatan harus menghasilkan total
        // yang dibayar pembeli. Diskon produk BUKAN pengurang tagihan.
        $nilaiProduk = (float) $raw[6][2];
        $voucher = (float) $raw[7][2];
        $ongkir = (float) $raw[8][2];
        $asuransi = (float) $raw[9][2];
        $cod = (float) $raw[10][2];
        $totalDibayar = (float) $raw[11][2];

        $this->assertEqualsWithDelta(
            $totalDibayar,
            $nilaiProduk + $voucher + $ongkir + $asuransi + $cod,
            0.5,
            'pendapatan bertingkat harus berjumlah total dibayar pembeli'
        );
        $this->assertEqualsWithDelta(125000000.0, $totalDibayar, 0.5);

        // Nilai sel tetap numerik, bukan teks.
        $this->assertIsNumeric($raw[6][2]);

        // Asersi gaya anti-regresi (insiden 2026-09-11: nomor baris style
        // mendarat di baris data karena baris pemisah dibuang writer).
        $lrSheet = $ss->getSheetByName('Laba Rugi');

        // Penanda kolom (baris 5): fill merah brand, font putih.
        $this->assertSame('FFC20000', $lrSheet->getCell('B5')->getStyle()->getFill()->getStartColor()->getARGB());
        $this->assertSame('FFFFFFFF', $lrSheet->getCell('B5')->getStyle()->getFont()->getColor()->getARGB());

        // Header grup PENDAPATAN (baris 6): zebra surface + font merah brand.
        $this->assertSame('FFF7F8F7', $lrSheet->getCell('B6')->getStyle()->getFill()->getStartColor()->getARGB());
        $this->assertSame('FFC20000', $lrSheet->getCell('B6')->getStyle()->getFont()->getColor()->getARGB());

        // Baris data pertama (baris 7): format ribuan terpasang, font hitam normal.
        $this->assertSame('#,##0', $lrSheet->getCell('C7')->getStyle()->getNumberFormat()->getFormatCode());
        $this->assertSame('FF000000', $lrSheet->getCell('B7')->getStyle()->getFont()->getColor()->getARGB());

        // Biaya COD diteruskan ke J&T (baris 17): TIDAK boleh kena gaya header grup.
        $this->assertNotSame('FFC20000', $lrSheet->getCell('B17')->getStyle()->getFont()->getColor()->getARGB());

        // PENJUALAN BERSIH (baris 23): double underline akuntansi.
        $this->assertSame('double', $lrSheet->getCell('B23')->getStyle()->getBorders()->getBottom()->getBorderStyle());

        // Pembayaran sudah diterima (baris 29): subtotal arus kas biasa, TANPA double underline.
        $this->assertNotSame('double', $lrSheet->getCell('B29')->getStyle()->getBorders()->getBottom()->getBorderStyle());

        // KPI bernilai 0 (COD Dibayar, baris 38) tetap tertulis 0 numerik,
        // bukan sel kosong: WithStrictNullComparison mencegah nol dibuang.
        $this->assertSame('COD Dibayar', trim((string) $rows[38]['B']));
        $this->assertIsNumeric($raw[37][2]);
        $this->assertSame(0.0, (float) $raw[37][2]);

        // ---- RINCIAN PESANAN: header WAJIB di baris 1 ----
        $rp = $ss->getSheetByName('Rincian Pesanan');
        $rpRows = $rp->toArray(null, true, true, true);
        $this->assertSame('Nomor Pesanan', $rpRows[1]['A'], 'header harus di baris 1, bukan di tengah sheet');
        $this->assertSame('Nilai Produk Terjual', $rpRows[1]['H']);
        $this->assertSame('Total Dibayar Pembeli', $rpRows[1]['M'], 'total dibayar sebelum kolom beban');
        $this->assertSame('Penjualan Bersih', $rpRows[1]['Q'], 'penjualan bersih setelah beban');

        // Status dalam bahasa Indonesia, bukan nilai mentah basis data.
        $this->assertSame('COD', $rpRows[2]['D']);
        $this->assertSame('Diproses', $rpRows[2]['E']);
        $this->assertSame('Belum dibayar', $rpRows[2]['F']);

        // Sel tanggal yang tidak punya nilai dibiarkan kosong, tanpa apostrof.
        $this->assertNull($rpRows[2]['C']);

        // Baris JUMLAH menutup tabel supaya bisa dicocokkan dengan Laba Rugi.
        $this->assertSame('JUMLAH', $rpRows[3]['A']);

        // ---- ANALISIS: lima blok berjudul dalam satu sheet ----
        $an = $ss->getSheetByName('Analisis');
        $anText = implode(' ', array_map(
            fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)),
            $an->toArray()
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

        // ---- PANDUAN ----
        $guide = $ss->getSheetByName('Panduan')->toArray();
        $guideText = implode(' ', array_map(fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)), $guide));
        $this->assertStringContainsString('Periode laporan: 2026-08-26 sampai 2026-09-01', $guideText);

        // Regresi 2026-09-11: pemisah [] dibuang writer membuat konten Panduan
        // bergeser ke baris 3 dan kehilangan gaya label (merah tebal + border).
        $gs = $ss->getSheetByName('Panduan');
        $this->assertSame('ISI BERKAS', $gs->getCell('A4')->getValue());
        $this->assertSame('FFC20000', $gs->getCell('A4')->getStyle()->getFont()->getColor()->getARGB());
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
            \Illuminate\Support\Facades\Storage::disk('imports')->path('perf-empty.xlsx')
        );

        $text = implode(' ', array_map(
            fn ($r) => implode(' ', array_map(fn ($c) => (string) $c, $r)),
            $ss->getSheetByName('Analisis')->toArray()
        ));

        // Pembaca harus bisa membedakan "tidak ada data" dari "gagal dimuat",
        // jadi blok kosong tidak boleh berupa header telanjang.
        $this->assertStringContainsString('Tidak ada produk terjual', $text);
        $this->assertStringContainsString('Belum ada data kunjungan produk', $text);
        $this->assertStringContainsString('Tidak ada pelanggan', $text);
        $this->assertStringContainsString('Tidak ada transaksi', $text);
        $this->assertStringContainsString('Tidak ada biaya retur', $text);
    }

    public function test_periode_pembanding_kosong_tidak_menghasilkan_persen_palsu(): void
    {
        $payload = $this->payload();
        $payload['previous_has_data'] = false;

        Excel::store(new StorePerformanceExport($payload), 'perf-noprev.xlsx', 'imports');
        $ss = IOFactory::load(
            \Illuminate\Support\Facades\Storage::disk('imports')->path('perf-noprev.xlsx')
        );

        $rows = $ss->getSheetByName('Laba Rugi')->toArray(null, true, true, true);
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
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load($response->getFile()->getPathname());

        // 5 sheet x 2 bulan kalender (Agt 2026 + Sep 2026).
        $this->assertCount(10, $ss->getSheetNames());

        // Laba Rugi Agustus memuat angka pesanan RA-MM-1.
        $lr = $ss->getSheetByName('Laba Rugi (Agt 2026)');
        $vals = [];
        for ($r = 1; $r <= $lr->getHighestRow(); $r++) {
            $b = trim((string) $lr->getCell('B'.$r)->getValue());
            $c = $lr->getCell('C'.$r)->getValue();
            if ($b !== '' && is_numeric($c)) {
                $vals[$b] = (float) $c;
            }
        }
        $this->assertGreaterThan(0, $vals['TOTAL DIBAYAR PEMBELI'] ?? 0);

        // Rincian Pesanan Agustus WAJIB berisi baris pesanan + JUMLAH yang
        // cocok dengan Laba Rugi bulan yang sama, bukan "Tidak ada pesanan".
        $rp = $ss->getSheetByName('Rincian Pesanan (Agt 2026)');
        $this->assertSame('RA-MM-1', $rp->getCell('A2')->getValue());

        $jumlahRow = null;
        for ($r = 1; $r <= $rp->getHighestRow(); $r++) {
            if (trim((string) $rp->getCell('A'.$r)->getValue()) === 'JUMLAH') {
                $jumlahRow = $r;
                break;
            }
        }
        $this->assertNotNull($jumlahRow, 'baris JUMLAH wajib ada');
        $this->assertEqualsWithDelta(
            $vals['TOTAL DIBAYAR PEMBELI'],
            (float) $rp->getCell('M'.$jumlahRow)->getValue(),
            0.5,
            'JUMLAH Rincian Pesanan Agustus wajib sama dengan Laba Rugi Agustus'
        );

        // Item Terjual Agustus juga terisi.
        $it = $ss->getSheetByName('Item Terjual (Agt 2026)');
        $this->assertSame('RA-MM-1', $it->getCell('A2')->getValue());
    }
}