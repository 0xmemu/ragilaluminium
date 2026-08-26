<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Services\ActivityLogService;
use App\Support\ExportSafety;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ActivityLogExport extends RagilStyledExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(protected Collection $rows)
    {
        $this->sheetTitle = 'Log Aktivitas';
        $this->columnWidths = ['A' => 20, 'B' => 22, 'C' => 18, 'D' => 72];
    }

    public function collection()
    {
        ExportSafety::assertCountWithinLimit($this->rows->count());

        return $this->rows;
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'Waktu', 'Admin', 'Aksi', 'Deskripsi',
        ]);
    }

    public function map($log): array
    {
        $svc = app(ActivityLogService::class);

        return array_map([ExportSafety::class, 'cell'], [
            $this->formatWib($log->created_at),
            $svc->actorLabel($log),
            $svc->categoryLabel($svc->categoryFor($log)),
            $svc->describe($log),
        ]);
    }
}
