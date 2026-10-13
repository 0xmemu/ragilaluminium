<?php

namespace App\Exports;

use App\Support\ExportSafety;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

/**
 * File koreksi hasil import: berisi baris yang gagal beserta alasannya.
 *
 * File ini BOLAK-BALIK: admin mengunduhnya, memperbaiki isinya, lalu
 * meng-upload ulang. Karena itu nilai teks harus kembali persis seperti
 * aslinya. Kalau nilai seperti SKU angka ditulis sebagai ANGKA, Excel
 * menampilkannya sebagai notasi ilmiah dan, di atas 15 digit, membulatkan
 * digit terakhir sehingga SKU tidak lagi cocok saat di-upload ulang.
 *
 * afterSheet mengembalikan setiap nilai yang aslinya teks menjadi teks.
 */
class CorrectionFileExport implements FromCollection, WithHeadings, WithMapping, WithEvents
{
    use RegistersEventListeners;

    public function __construct(protected Collection $failedRows)
    {
        ExportSafety::assertCountWithinLimit($failedRows->count());
    }

    public function collection(): Collection
    {
        return $this->failedRows;
    }

    public function map($row): array
    {
        return ExportSafety::row(array_merge(
            $row->raw_data ?? [],
            ['error_reason' => $row->error_reason]
        ));
    }

    public function headings(): array
    {
        $first = $this->failedRows->first();
        $keys = $first && is_array($first->raw_data) ? array_keys($first->raw_data) : [];

        return ExportSafety::row(array_merge($keys, ['error_reason']));
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        // Baris 1 = judul kolom, data mulai baris 2.
        $rowNum = 2;

        foreach ($this->failedRows as $row) {
            $values = array_values($row->raw_data ?? []);
            $values[] = $row->error_reason;

            $colIdx = 1;
            foreach ($values as $value) {
                if (is_string($value) && $value !== '') {
                    $coord = Coordinate::stringFromColumnIndex($colIdx).$rowNum;
                    $sheet->setCellValueExplicit(
                        $coord,
                        ExportSafety::cell($value),
                        DataType::TYPE_STRING
                    );
                    $sheet->getStyle($coord)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
                }
                $colIdx++;
            }

            $rowNum++;
        }
    }
}
