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
            'financial' => [
                'gross_revenue' => 125000000.0,
                'refund_adjustments' => 2500000.0,
                'net_revenue' => 122500000.0,
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

        $this->assertSame(
            ['Ringkasan', 'Produk Terlaris', 'Pelanggan Terbaik', 'Biaya Retur', 'Panduan'],
            $ss->getSheetNames()
        );

        // Ringkasan: header + Ringkasan Keuangan + KPI + KPI dengan 0
        $ring = $ss->getSheetByName('Ringkasan');
        $ringRows = $ring->toArray(null, true, true, true);
        $this->assertSame('Bagian', $ringRows[1]['A']);
        $this->assertSame('Penjualan Gross', $ringRows[2]['B']);
        $this->assertSame('125,000,000', $ringRows[2]['C'], 'angka polos tanpa Rp');
        $this->assertSame('Penjualan Bersih', $ringRows[4]['B']);
        $this->assertSame('122,500,000', $ringRows[4]['C']);
        $this->assertSame('Omset', $ringRows[5]['B']);
        $this->assertSame('125,000,000', $ringRows[5]['C']);
        $this->assertSame('25.0%', $ringRows[5]['E'], 'perubahan persen');
        $this->assertSame('47', $ringRows[6]['C'], 'jumlah unit');
        // KPI persen: nilai skala persen + format
        $this->assertSame('3.20%', $ringRows[7]['C'], 'nilai persen 3.2%');
        $this->assertSame('Baru pada periode ini', $ringRows[7]['E']);
        // nilai 0 TIDAK boleh hilang (bug loose-null Maatwebsite)
        $this->assertSame('0', $ringRows[8]['C'], 'COD Dibayar 0 tetap tampil');
        $this->assertSame('0.0%', $ringRows[8]['E']);

        // Ringkasan: nilai sel tetap numerik
        $raw = $ring->toArray(null, true, false);
        $this->assertEquals(125000000.0, (float) $raw[1][2]);
        $this->assertEqualsWithDelta(3.2, (float) $raw[6][2], 0.001);

        // Produk Terlaris
        $prod = $ss->getSheetByName('Produk Terlaris');
        $prodRows = $prod->toArray(null, true, true, true);
        $this->assertSame('SKU Induk', $prodRows[1]['A']);
        $this->assertSame('RGL-JNG-JKT-1', $prodRows[2]['A']);
        $this->assertSame('12', $prodRows[2]['C']);
        $this->assertSame('102,050,000', $prodRows[2]['D']);
        $this->assertSame('6', $prodRows[2]['E']);

        // Pelanggan Terbaik: tanggal WIB
        $cust = $ss->getSheetByName('Pelanggan Terbaik');
        $custRows = $cust->toArray(null, true, true, true);
        $this->assertSame('Budi Santoso', $custRows[2]['A']);
        $this->assertSame('3', $custRows[2]['C']);
        $this->assertSame('15,000,000', $custRows[2]['D']);
        $this->assertSame('1 Sep 2026 09:30', $custRows[2]['E'], 'tanggal WIB d M Y H:i');

        // Biaya Retur: fault_party dilabel, tanggal WIB
        $ret = $ss->getSheetByName('Biaya Retur');
        $retRows = $ret->toArray(null, true, true, true);
        $this->assertSame('ORD26080005', $retRows[2]['A']);
        $this->assertSame('30 Agt 2026 14:10', $retRows[2]['B']);
        $this->assertSame('Toko', $retRows[2]['C']);
        $this->assertSame('barang pecah', $retRows[2]['D']);
        $this->assertSame('75,000', $retRows[2]['E']);

        // Panduan menjelaskan aturan + format
        $guide = $ss->getSheetByName('Panduan')->toArray();
        $guideText = implode(' ', array_map(fn ($r) => implode(' ', $r), $guide));
        $this->assertStringContainsString('Periode laporan: 2026-08-26 s.d. 2026-09-01', $guideText);
        $this->assertStringContainsString('Penjualan Bersih', $guideText);
        $this->assertStringContainsString('Tiga level', $guideText);
        $this->assertStringContainsString('tanpa "Rp"', $guideText);
    }
}