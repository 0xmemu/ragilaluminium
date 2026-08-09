<?php

namespace App\Exports;

use App\Support\ExportSafety;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class CorrectionFileExport implements FromCollection, WithHeadings, WithMapping
{
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
}
