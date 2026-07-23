<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class CorrectionFileExport implements FromCollection, WithHeadings
{
    public function __construct(protected Collection $failedRows)
    {
    }

    public function collection(): Collection
    {
        return $this->failedRows->map(fn ($row) => array_merge(
            $row->raw_data ?? [],
            ['error_reason' => $row->error_reason]
        ));
    }

    public function headings(): array
    {
        $first = $this->failedRows->first();
        $keys = $first && is_array($first->raw_data) ? array_keys($first->raw_data) : [];

        return array_merge($keys, ['error_reason']);
    }
}
