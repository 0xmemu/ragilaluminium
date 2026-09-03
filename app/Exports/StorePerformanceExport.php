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
 *   2. Produk Terlaris  - 1 baris per produk (parent SKU)
 *   3. Pelanggan Terbaik- 1 baris per pelanggan
 *   4. Biaya Retur      - 1 baris per kasus retur selesai (ongkir ditanggung toko)
 *   5. Panduan          - aturan baca, vocabulary, format angka
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

// ------ 2. PRODUK TERLARIS ------

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

// ------ 3. PELANGGAN TERBAIK ------

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

// ------ 5. PANDUAN ------

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
            ['VOCABULARY', 'Penjualan Gross = total nilai pesanan periode ini (omzet, dihitung sejak pesanan diproses, termasuk COD). Refund Retur = nilai refund dari retur yang benar-benar selesai. Penjualan Bersih = Penjualan Gross dikurangi Refund Retur. Pembayaran Diterima = pembayaran yang tercatat lunas (COD baru lunas saat paket tiba).'],
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