<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

/**
 * Laporan ringkas performa toko (KPI + produk terlaris + pelanggan + biaya retur).
 * Satu sheet "Performa Toko" dengan section header, bergaya brand DS v2.
 */
class StorePerformanceExport extends RagilStyledExport implements FromArray
{
    /** @var list<list<mixed>> */
    protected array $rows = [];

    /** @var list<array{0: int, 1: int}> koordinat sel mata uang [baris, indeks kolom] */
    protected array $currencyCells = [];

    /** @var list<array{0: int, 1: int}> koordinat sel kuantitas [baris, indeks kolom] */
    protected array $quantityCells = [];

    /** @var list<int> nomor baris yang dipakai sebagai section header */
    protected array $sectionRows = [];

    public function __construct(protected array $payload)
    {
        $this->sheetTitle = 'Performa Toko';
        $this->columnWidths = ['A' => 28, 'B' => 26, 'C' => 22, 'D' => 22, 'E' => 18];

        $this->build();
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $lastRow = $sheet->getHighestRow();
        $lastCol = $sheet->getHighestColumn();

        $sheet->freezePane('A2');

        $usedRange = "A1:{$lastCol}{$lastRow}";
        $sheet->getStyle($usedRange)->getBorders()->getAllBorders()->applyFromArray([
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['argb' => 'FFDEE3E0'],
        ]);

        // Section header: tebal.
        foreach ($this->sectionRows as $rowNum) {
            $sheet->getStyle("A{$rowNum}:{$lastCol}{$rowNum}")->getFont()->setBold(true);
        }

        // Format mata uang pada sel terpilih.
        foreach ($this->currencyCells as [$rowNum, $colIdx]) {
            $coord = $this->cellCoord($rowNum, $colIdx);
            $sheet->getStyle($coord)->getNumberFormat()->setFormatCode('"Rp" #,##0');
            $sheet->getStyle($coord)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        // Format kuantitas pada sel terpilih.
        foreach ($this->quantityCells as [$rowNum, $colIdx]) {
            $coord = $this->cellCoord($rowNum, $colIdx);
            $sheet->getStyle($coord)->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle($coord)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }
    }

    protected function build(): void
    {
        $rows = [];
        $currency = [];
        $quantity = [];
        $sections = [];
        $r = 1;

        $guard = static fn ($value) => ExportSafety::cell($value);

        $rows[] = [$guard('Performa Toko'), $guard($this->payload['range']['label'] ?? ''), '', '', ''];
        $r++;

        $rows[] = [
            $guard('Periode'),
            $guard(($this->payload['range']['from_date'] ?? '-').' s.d. '.($this->payload['range']['to_date'] ?? '-')),
            '', '', '',
        ];
        $r++;
        $r++; // baris kosong

        // Ringkasan keuangan.
        $sections[] = $r;
        $rows[] = [$guard('Ringkasan Keuangan'), '', '', '', ''];
        $r++;
        $fin = $this->payload['financial'] ?? [];
        foreach ([
            ['Penjualan (Gross)', $fin['gross_revenue'] ?? 0],
            ['Penjualan Bersih', $fin['net_revenue'] ?? 0],
            ['Refund Diberikan', $fin['refund_adjustments'] ?? 0],
        ] as [$label, $value]) {
            $rows[] = ['', $guard($label), $guard($value), '', ''];
            $currency[] = [$r, 3];
            $r++;
        }
        $r++;

        // KPI utama.
        $sections[] = $r;
        $rows[] = [$guard('KPI Utama'), '', '', '', ''];
        $r++;
        $rows[] = [
            $guard('Bagian'), $guard('Metrik'), $guard('Nilai'),
            $guard('Periode Sebelumnya'), $guard('Perubahan %'),
        ];
        $r++;
        foreach ($this->payload['sections'] ?? [] as $section) {
            foreach ($section['kpis'] as $kpi) {
                $rows[] = [
                    $guard($section['title']),
                    $guard($kpi['label']),
                    $guard($kpi['value'] ?? 0),
                    $guard($kpi['previous'] ?? 0),
                    $guard($kpi['change_percent'] === null ? 'Baru pada periode ini' : $kpi['change_percent']),
                ];
                $r++;
            }
        }
        $r++;

        // Produk terlaris.
        $sections[] = $r;
        $rows[] = [$guard('Produk Terlaris'), '', '', '', ''];
        $r++;
        $rows[] = [
            $guard('SKU Induk'), $guard('Nama'), $guard('Unit'),
            $guard('Omzet (Rp)'), $guard('Jumlah Order'),
        ];
        $r++;
        foreach ($this->payload['top_products'] ?? [] as $p) {
            $rows[] = [
                $guard($p['parent_sku'] ?? ''),
                $guard($p['name'] ?? ''),
                $guard($p['units'] ?? 0),
                $guard($p['revenue'] ?? 0),
                $guard($p['order_count'] ?? 0),
            ];
            $currency[] = [$r, 4];
            $quantity[] = [$r, 3];
            $quantity[] = [$r, 5];
            $r++;
        }
        $r++;

        // Pelanggan terbaik.
        $sections[] = $r;
        $rows[] = [$guard('Pelanggan Terbaik'), '', '', '', ''];
        $r++;
        $rows[] = [
            $guard('Nama'), $guard('No. HP'), $guard('Frekuensi'),
            $guard('Total Belanja (Rp)'), $guard('Order Terakhir'),
        ];
        $r++;
        foreach ($this->payload['customers'] ?? [] as $c) {
            $rows[] = [
                $guard($c['customer_name'] ?? ''),
                $guard($c['customer_phone'] ?? ''),
                $guard($c['order_count'] ?? 0),
                $guard($c['total_spent'] ?? 0),
                $guard($c['last_order_at'] ?? '-'),
            ];
            $currency[] = [$r, 4];
            $quantity[] = [$r, 3];
            $r++;
        }
        $r++;

        // Biaya retur (ongkir retur ditanggung toko).
        $rcList = $this->payload['return_shipping_costs'] ?? [];
        $rcTotal = (float) Collection::make($rcList)->sum('return_shipping_cost');
        $sections[] = $r;
        $rows[] = [$guard('Biaya Retur (Ongkir)'), '', '', '', ''];
        $r++;
        $rows[] = [
            $guard('Total periode'), '', $guard($rcTotal), $guard(count($rcList)), '',
        ];
        $currency[] = [$r, 3];
        $quantity[] = [$r, 4];
        $r++;
        $rows[] = [
            $guard('Order'), $guard('Tanggal Selesai'), $guard('Pihak Penyebab'),
            $guard('Alasan'), $guard('Ongkir Retur'),
        ];
        $r++;
        foreach ($rcList as $rc) {
            $rows[] = [
                $guard($rc['order_number'] ?? ($rc['order_id'] ?? '')),
                $guard($rc['completed_at'] ?? '-'),
                $guard($rc['fault_party'] ?? '-'),
                $guard($rc['reason'] ?? '-'),
                $guard($rc['return_shipping_cost'] ?? 0),
            ];
            $currency[] = [$r, 5];
            $r++;
        }

        $this->rows = $rows;
        $this->currencyCells = $currency;
        $this->quantityCells = $quantity;
        $this->sectionRows = $sections;
    }
}
