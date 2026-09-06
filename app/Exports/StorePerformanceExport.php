<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Laporan Performa Toko XLSX, desain tabel mengikuti Laporan Pesanan
 * (OrderExport): setiap sheet = SATU tabel datar (header merah #c20000,
 * zebra, freeze A2, autofilter), angka POLOS tanpa "Rp" (nilai sel tetap
 * numerik), plus sheet Panduan. Sheet:
 *   1. Ringkasan        - Ringkasan Keuangan + KPI Utama (1 baris per metrik)
 *   2. Income Detail    - 1 baris per pesanan, kolom metrik (gaya laporan income marketplace)
 *   3. Item Terjual     - 1 baris per item pesanan (SKU, qty, harga)
 *   4. Produk Terlaris  - 1 baris per produk (parent SKU)
 *   5. Pelanggan Terbaik- 1 baris per pelanggan
 *   6. Biaya Retur      - 1 baris per kasus retur selesai (ongkir ditanggung toko)
 *   7. Panduan          - aturan baca, vocabulary, format angka
 */
class StorePerformanceExport implements WithMultipleSheets
{
    /**
     * @param string|null $sheetSuffix Label bulan utk export multi-bulan
     *                                 (mis. " Jan 2026") -> nama sheet unik
     *                                 per bulan dalam satu file.
     */
    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
    }

    public function sheets(): array
    {
        return [
            new StorePerformanceSummarySheet($this->payload, $this->sheetSuffix),
            new StorePerformanceIncomeDetailSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceSoldItemsSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceTopProductsSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceCustomersSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceReturnCostSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceGuideSheet($this->payload, $this->sheetSuffix),
        ];
    }
}

/**
 * Basis sheet tabel datar: styling RagilStyledExport (header merah baris 1,
 * border, zebra, freeze, autofilter) + format angka per sel.
 */
abstract class StorePerformanceTableSheet extends RagilStyledExport implements FromArray, WithTitle
{
    /** @var list<array{0: int, 1: int, 2: string}> [baris, indeks kolom, format] */
    protected array $numberCells = [];

    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
        $this->currencyFormat = '#,##0';
        $this->configure();
        if ($this->sheetSuffix !== null && $this->sheetSuffix !== '') {
            $this->sheetTitle = $this->sheetTitle.' ('.$this->sheetSuffix.')';
        }
    }

    abstract protected function configure(): void;

    abstract protected function buildRows(): array;

    public function array(): array
    {
        return $this->buildRows();
    }

    public function afterSheet(AfterSheet $event): void
    {
        parent::afterSheet($event);

        $sheet = $event->sheet->getDelegate();
        foreach ($this->numberCells as [$rowNum, $colIdx, $fmt]) {
            $coord = $this->cellCoord($rowNum, $colIdx);
            $sheet->getStyle($coord)->getNumberFormat()->setFormatCode($fmt);
            $sheet->getStyle($coord)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }
    }

    protected function registerNumber(int $rowNum, int $colIdx, string $fmt): void
    {
        $this->numberCells[] = [$rowNum, $colIdx, $fmt];
    }

    /**
     * Format angka sesuai jenis KPI (nilai persen sudah skala persen).
     */
    protected function kpiNumberFormat(string $kpiFormat): string
    {
        return match ($kpiFormat) {
            'percent' => '0.00"%"',
            'hours' => '0.00" jam"',
            'days' => '0.0" hari"',
            default => '#,##0',
        };
    }
}

// ------ 1. RINGKASAN (Ringkasan Keuangan + KPI Utama) ------

class StorePerformanceSummarySheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Ringkasan';
        $this->columnWidths = ['A' => 24, 'B' => 36, 'C' => 18, 'D' => 18, 'E' => 16];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $rows[] = ['Bagian', 'Metrik', 'Nilai', 'Periode Sebelumnya', 'Perubahan %'];
        $r++;

        $financialRow = fn (string $label, $value) => ['Ringkasan Keuangan', $label, $value, '-', '-'];
        $fin = $this->payload['financial'] ?? [];
        foreach ([
            ['Penjualan Gross', $fin['gross_revenue'] ?? 0],
            ['Refund Retur', $fin['refund_adjustments'] ?? 0],
            ['Penjualan Bersih', $fin['net_revenue'] ?? 0],
        ] as [$label, $value]) {
            $row = $financialRow($guard($label), $guard($value));
            $rows[] = $row;
            $this->registerNumber($r, 3, '#,##0');
            $this->trackZeroCells($row, $r);
            $r++;
        }

        foreach ($this->payload['sections'] ?? [] as $section) {
            foreach ($section['kpis'] as $kpi) {
                $change = $kpi['change_percent'];
                $row = [
                    $guard($section['title']),
                    $guard($kpi['label']),
                    $guard($kpi['value'] ?? 0),
                    $guard($kpi['previous'] ?? 0),
                    $change === null ? 'Baru pada periode ini' : $guard($change),
                ];
                $rows[] = $row;
                $fmt = $this->kpiNumberFormat((string) ($kpi['format'] ?? 'number'));
                $this->registerNumber($r, 3, $fmt);
                $this->registerNumber($r, 4, $fmt);
                if ($change !== null) {
                    $this->registerNumber($r, 5, '0.0"%"');
                }
                $this->trackZeroCells($row, $r);
                $r++;
            }
        }

        return $rows;
    }
}

// ------ 2. INCOME DETAIL (1 baris = 1 pesanan, kolom metrik di atas) ------

class StorePerformanceIncomeDetailSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Income Detail';
        $this->columnWidths = [
            'A' => 16, 'B' => 17, 'C' => 17, 'D' => 12, 'E' => 14,
            'F' => 15, 'G' => 13, 'H' => 13, 'I' => 13, 'J' => 13,
            'K' => 13, 'L' => 13, 'M' => 15, 'N' => 13, 'O' => 14,
            'P' => 15, 'Q' => 15, 'R' => 14,
        ];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        // Rekap singkat di atas (gaya sheet "Laporan" pada contoh income marketplace),
        // dua kolom: label + nilai. Baris detail mulai setelah blok rekap.
        $fin = $this->payload['financial'] ?? [];
        $recap = [
            ['Periode', ($this->payload['range']['from_date'] ?? '-').' s.d. '.($this->payload['range']['to_date'] ?? '-')],
            ['Penjualan Gross', (float) ($fin['gross_revenue'] ?? 0)],
            ['Ongkir Raw J&T', (float) ($fin['shipping_raw'] ?? 0)],
            ['Biaya COD, diteruskan ke J&T', (float) ($fin['cod_fee'] ?? 0)],
            ['Subsidi Ongkir, beban toko', (float) ($fin['shipping_subsidy'] ?? 0)],
            ['Refund Retur', (float) ($fin['refund_adjustments'] ?? 0)],
            ['Ongkir Retur, beban toko', (float) ($fin['return_shipping_store'] ?? 0)],
            ['Penjualan Bersih', (float) ($fin['net_revenue'] ?? 0)],
            ['Pembayaran Diterima', (float) ($fin['payments_received'] ?? 0)],
        ];
        foreach ($recap as [$label, $value]) {
            $rows[] = [$label, $value];
            if (is_float($value) || is_int($value)) {
                $this->registerNumber($r, 2, '#,##0');
            }
            $r++;
        }
        $rows[] = []; // pemisah
        $r++;

        // Header tabel detail (metrik = kolom, data = baris)
        $rows[] = [
            'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Dibayar', 'Metode',
            'Status Pesanan', 'Status Pembayaran',
            'Subtotal Sebelum Diskon', 'Diskon Produk', 'Voucher',
            'Penjualan Gross', 'Ongkir Raw J&T', 'Subsidi Ongkir Toko',
            'Ongkir Dibayar Pelanggan', 'Biaya COD Pelanggan', 'Refund Retur',
            'Ongkir Retur Toko', 'Penjualan Bersih', 'Asuransi',
            'Total Dibayar Pembeli', 'Uang Masuk', 'Sisa Belum Cair', 'Jumlah Item',
        ];
        $r++;

        foreach ($this->payload['income_detail'] ?? [] as $row) {
            $paidAt = $row['paid_at'] ?? null;
            $out = [
                $guard($row['order_number'] ?? '-'),
                $guard($this->formatWib($row['created_at'] ?? null, 'j M Y H:i')),
                $guard($paidAt ? $this->formatWib($paidAt, 'j M Y H:i') : '-'),
                $guard($row['payment_method'] ?? '-'),
                $guard($row['order_status'] ?? '-'),
                $guard($row['payment_status'] ?? '-'),
                $guard($row['subtotal_before_discount'] ?? 0),
                $guard($row['discount'] ?? 0),
                $guard($row['voucher_discount'] ?? 0),
                $guard($row['gross_revenue'] ?? 0),
                $guard($row['shipping_raw'] ?? 0),
                $guard($row['shipping_subsidy'] ?? 0),
                $guard($row['shipping_net_paid_by_customer'] ?? 0),
                $guard($row['cod_fee'] ?? 0),
                $guard($row['refund_amount'] ?? 0),
                $guard($row['return_shipping_store'] ?? 0),
                $guard($row['net_revenue'] ?? 0),
                $guard($row['insurance'] ?? 0),
                $guard($row['total_paid_by_customer'] ?? 0),
                $guard($row['paid_amount'] ?? 0),
                $guard($row['outstanding'] ?? 0),
                $guard($row['items_count'] ?? 0),
            ];
            $rows[] = $out;
            for ($c = 7; $c <= 22; $c++) {
                $this->registerNumber($r, $c, '#,##0');
            }
            $this->trackZeroCells($out, $r);
            $r++;
        }

        return $rows;
    }
}

// ------ 3. ITEM TERJUAL (1 baris = 1 item pesanan) ------

class StorePerformanceSoldItemsSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Item Terjual';
        $this->columnWidths = [
            'A' => 16, 'B' => 17, 'C' => 14, 'D' => 34, 'E' => 18,
            'F' => 16, 'G' => 12, 'H' => 14, 'I' => 14,
        ];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $rows[] = [
            'Nomor Pesanan', 'Tanggal Pesanan', 'Parent SKU', 'Nama Produk',
            'Variasi', 'Harga Satuan', 'Qty', 'Subtotal Baris', 'Diskon Baris',
        ];
        $r++;

        foreach ($this->payload['sold_items'] ?? [] as $row) {
            $out = [
                $guard($row['order_number'] ?? '-'),
                $guard($this->formatWib($row['created_at'] ?? null, 'j M Y H:i')),
                $guard($row['parent_sku'] ?? '-'),
                $guard($row['name'] ?? '-'),
                $guard($row['variation'] ?? '-'),
                $guard($row['unit_price'] ?? 0),
                $guard($row['quantity'] ?? 0),
                $guard($row['line_total'] ?? 0),
                $guard($row['line_discount'] ?? 0),
            ];
            $rows[] = $out;
            $this->registerNumber($r, 6, '#,##0');
            $this->registerNumber($r, 7, '#,##0');
            $this->registerNumber($r, 8, '#,##0');
            $this->registerNumber($r, 9, '#,##0');
            $this->trackZeroCells($out, $r);
            $r++;
        }

        return $rows;
    }
}

// ------ 4. PRODUK TERLARIS ------

class StorePerformanceTopProductsSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Produk Terlaris';
        $this->columnWidths = ['A' => 18, 'B' => 48, 'C' => 12, 'D' => 16, 'E' => 14];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $rows[] = ['SKU Induk', 'Nama Produk', 'Unit Terjual', 'Penjualan', 'Jumlah Order'];
        $r++;

        foreach ($this->payload['top_products'] ?? [] as $p) {
            $row = [
                $guard($p['parent_sku'] ?? ''),
                $guard($p['name'] ?? ''),
                $guard($p['units'] ?? 0),
                $guard($p['revenue'] ?? 0),
                $guard($p['order_count'] ?? 0),
            ];
            $rows[] = $row;
            $this->registerNumber($r, 3, '#,##0');
            $this->registerNumber($r, 4, '#,##0');
            $this->registerNumber($r, 5, '#,##0');
            $this->trackZeroCells($row, $r);
            $r++;
        }

        return $rows;
    }
}

// ------ 5. PELANGGAN TERBAIK ------

class StorePerformanceCustomersSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Pelanggan Terbaik';
        $this->columnWidths = ['A' => 26, 'B' => 18, 'C' => 12, 'D' => 16, 'E' => 20];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $rows[] = ['Nama Pelanggan', 'No. HP', 'Frekuensi', 'Total Belanja', 'Order Terakhir'];
        $r++;

        foreach ($this->payload['customers'] ?? [] as $c) {
            $lastAt = $c['last_order_at'] ?? null;
            if ($lastAt && $lastAt !== '-') {
                try {
                    $lastAt = $this->formatWib($lastAt, 'j M Y H:i');
                } catch (\Throwable) {
                    $lastAt = (string) $lastAt;
                }
            } else {
                $lastAt = $lastAt ?: '-';
            }
            $row = [
                $guard($c['customer_name'] ?? ''),
                $guard($c['customer_phone'] ?? ''),
                $guard($c['order_count'] ?? 0),
                $guard($c['total_spent'] ?? 0),
                $guard($lastAt),
            ];
            $rows[] = $row;
            $this->registerNumber($r, 3, '#,##0');
            $this->registerNumber($r, 4, '#,##0');
            $this->trackZeroCells($row, $r);
            $r++;
        }

        return $rows;
    }
}

// ------ 4. BIAYA RETUR (ongkir retur ditanggung toko) ------

class StorePerformanceReturnCostSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Biaya Retur';
        $this->columnWidths = ['A' => 18, 'B' => 20, 'C' => 16, 'D' => 34, 'E' => 16];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $rows[] = ['Order', 'Tanggal Selesai', 'Pihak Penyebab', 'Alasan', 'Ongkir Retur'];
        $r++;

        foreach ($this->payload['return_shipping_costs'] ?? [] as $rc) {
            $completedAt = $rc['completed_at'] ?? null;
            if ($completedAt) {
                try {
                    $completedAt = $this->formatWib($completedAt, 'j M Y H:i');
                } catch (\Throwable) {
                    $completedAt = (string) $completedAt;
                }
            } else {
                $completedAt = '-';
            }
            $party = [
                'store' => 'Toko',
                'customer' => 'Pembeli',
            ][$rc['fault_party'] ?? ''] ?? ($rc['fault_party'] ?? '-');
            $row = [
                $guard($rc['order_number'] ?? ($rc['order_id'] ?? '')),
                $guard($completedAt),
                $guard($party),
                $guard($rc['reason'] ?? '-'),
                $guard($rc['return_shipping_cost'] ?? 0),
            ];
            $rows[] = $row;
            $this->registerNumber($r, 5, '#,##0');
            $this->trackZeroCells($row, $r);
            $r++;
        }

        return $rows;
    }
}

// ------ 7. PANDUAN ------

class StorePerformanceGuideSheet implements FromArray, WithTitle, \Maatwebsite\Excel\Concerns\WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
    }

    public function array(): array
    {
        $range = $this->payload['range'] ?? [];

        return [
            ['PANDUAN LAPORAN PERFORMA TOKO', 'Ragil Aluminium'],
            ['Periode laporan: '.($range['from_date'] ?? '-').' s.d. '.($range['to_date'] ?? '-')],
            [],
            ['ATURAN BARIS', 'Sheet Ringkasan = 1 baris per metrik; Produk Terlaris = 1 baris per produk (SKU induk); Pelanggan Terbaik = 1 baris per pelanggan; Biaya Retur = 1 baris per kasus retur selesai yang ongkirnya ditanggung toko.'],
            ['VOCABULARY', 'Penjualan Gross = total yang dibayar pelanggan, termasuk produk, ongkir, dan biaya COD. Ongkir Raw J&T = ongkir net pelanggan + subsidi ongkir toko. Biaya COD dibayar pelanggan dan diteruskan ke J&T. Penjualan Bersih = Gross - Ongkir Raw J&T - Biaya COD - Refund Retur - Ongkir Retur Toko. Order batal tidak masuk Gross/Net dan dicatat terpisah.'],
            ['METRIK PRODUK', 'Tiga level terpisah: Model Produk Terjual (jumlah jenis model unik), Produk Terjual (jumlah varian unik), Jumlah Unit Terjual (total unit). Beda level, jangan disamakan.'],
            ['KOLOM PERUBAHAN', 'Kolom "Perubahan %" membandingkan dengan periode sebelumnya. "Baru pada periode ini" = periode sebelumnya nol. 0.0% = tidak berubah.'],
            ['FORMAT ANGKA', 'Semua kolom uang memakai angka polos tanpa "Rp" (contoh: 3.000.000). Nilai sel tetap numerik, aman dijumlah dan bisa dibaca Excel maupun tools lain.'],
        ];
    }

    public function title(): string
    {
        return $this->sheetSuffix !== null && $this->sheetSuffix !== ''
            ? 'Panduan ('.$this->sheetSuffix.')'
            : 'Panduan';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
        ]);

        $last = $sheet->getHighestRow();
        $sheet->getStyle('A4:B'.$last)->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        for ($r = 4; $r <= $last; $r++) {
            $sheet->getStyle('A'.$r)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFC20000']],
            ]);
        }

        $sheet->getColumnDimension('A')->setWidth(26);
        $sheet->getColumnDimension('B')->setWidth(100);
    }
}