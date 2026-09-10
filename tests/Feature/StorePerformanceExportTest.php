<?php

namespace Tests\Feature;

use App\Exports\StorePerformanceExport;
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
        $this->assertSame('Keterangan', $rows[4]['B'], 'penanda kolom laporan');
        $this->assertSame('PENDAPATAN', $rows[5]['B']);

        // Urutan pendapatan: nilai produk, voucher, ongkir, asuransi, COD, total.
        $this->assertStringContainsString('Nilai produk terjual', (string) $rows[6]['B']);
        $this->assertStringContainsString('Potongan voucher', (string) $rows[7]['B']);
        $this->assertStringContainsString('TOTAL DIBAYAR PEMBELI', (string) $rows[11]['B']);

        $raw = $lr->toArray(null, true, false);

        // Identitas aritmetika: komponen pendapatan harus menghasilkan total
        // yang dibayar pembeli. Diskon produk BUKAN pengurang tagihan.
        $nilaiProduk = (float) $raw[5][2];
        $voucher = (float) $raw[6][2];
        $ongkir = (float) $raw[7][2];
        $asuransi = (float) $raw[8][2];
        $cod = (float) $raw[9][2];
        $totalDibayar = (float) $raw[10][2];

        $this->assertEqualsWithDelta(
            $totalDibayar,
            $nilaiProduk + $voucher + $ongkir + $asuransi + $cod,
            0.5,
            'pendapatan bertingkat harus berjumlah total dibayar pembeli'
        );
        $this->assertEqualsWithDelta(125000000.0, $totalDibayar, 0.5);

        // Nilai sel tetap numerik, bukan teks.
        $this->assertIsNumeric($raw[5][2]);

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
}