<?php

namespace App\Exports\Concerns;

use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Conditional;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Base styling untuk seluruh export admin Ragil (brand DS v2).
 *
 * Header baris 1: bold, fill merah #c20000, font putih, border #dee3e0.
 * Body: border #dee3e0, zebra #f7f8f7, freeze pane A2, autofilter pada header.
 * Kolom numerik: rata kanan, format "Rp" #,##0 (mata uang) atau #,##0 (kuantitas).
 *
 * Exporter turunan cukup mengisi properti $sheetTitle, $columnWidths,
 * $currencyColumns (huruf kolom) dan $quantityColumns, lalu mengimplementasikan
 * FromQuery/FromCollection + WithMapping + WithHeadings.
 */
abstract class RagilStyledExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    use RegistersEventListeners;

    protected string $sheetTitle = 'Laporan';

    /** @var array<string, int> lebar kolom per huruf (A, B, ...) */
    protected array $columnWidths = [];

    /** @var list<string> kolom mata uang (format "Rp" #,##0) */
    protected array $currencyColumns = [];

    /** @var list<string> kolom kuantitas (format #,##0) */
    protected array $quantityColumns = [];

    public function title(): string
    {
        return $this->sheetTitle;
    }

    public function columnWidths(): array
    {
        return $this->columnWidths;
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => [
                    'bold' => true,
                    'color' => ['argb' => 'FFFFFFFF'],
                    'size' => 11,
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFC20000'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_LEFT,
                    'vertical' => Alignment::VERTICAL_CENTER,
                ],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['argb' => 'FFDEE3E0'],
                    ],
                ],
            ],
        ];
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $lastRow = $sheet->getHighestRow();
        $lastCol = $sheet->getHighestColumn();

        // Freeze header row supaya kolom tetap terbaca saat scroll.
        $sheet->freezePane('A2');

        // AutoFilter pada baris header.
        if ($lastRow >= 1) {
            $sheet->setAutoFilter("A1:{$lastCol}1");
        }

        // Border untuk seluruh area terpakai.
        $usedRange = "A1:{$lastCol}{$lastRow}";
        $sheet->getStyle($usedRange)->getBorders()->getAllBorders()->applyFromArray([
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['argb' => 'FFDEE3E0'],
        ]);

        // Zebra strip pada body (baris genap) supaya mudah dibaca.
        if ($lastRow > 1) {
            $bodyRange = "A2:{$lastCol}{$lastRow}";
            $cond = new Conditional();
            $cond->setConditionType(Conditional::CONDITION_EXPRESSION);
            $cond->setConditions(['MOD(ROW(),2)=0']);
            $cond->getStyle()->getFill()->setFillType(Fill::FILL_SOLID);
            $cond->getStyle()->getFill()->getStartColor()->setARGB('FFF7F8F7');
            $sheet->getStyle($bodyRange)->setConditionalStyles([$cond]);
        }

        // Format kolom mata uang: rata kanan + "Rp" #,##0.
        foreach ($this->currencyColumns as $col) {
            $range = "{$col}2:{$col}{$lastRow}";
            $sheet->getStyle($range)->getNumberFormat()->setFormatCode('"Rp" #,##0');
            $sheet->getStyle($range)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        // Format kolom kuantitas: rata kanan + #,##0.
        foreach ($this->quantityColumns as $col) {
            $range = "{$col}2:{$col}{$lastRow}";
            $sheet->getStyle($range)->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle($range)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }
    }

    /**
     * Bantu menjadikan koordinat (baris, indeks kolom 1-based) menjadi "A1".
     */
    protected function cellCoord(int $row, int $colIndex): string
    {
        return Coordinate::stringFromColumnIndex($colIndex).$row;
    }

    /**
     * Format tanggal ke Bahasa Indonesia, timezone Asia/Jakarta.
     */
    protected function formatWib($value, string $format = 'd M Y H:i'): string
    {
        if ($value === null) {
            return '';
        }
        if ($value instanceof \DateTimeInterface) {
            $dt = \Carbon\Carbon::instance($value);
        } else {
            $dt = \Carbon\Carbon::parse($value);
        }
        return $dt->setTimezone('Asia/Jakarta')->locale('id')->translatedFormat($format);
    }
}
