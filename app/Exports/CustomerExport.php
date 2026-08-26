<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Customer;
use App\Services\CustomerService;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class CustomerExport extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Laporan Pelanggan';
        $this->columnWidths = [
            'A' => 24, 'B' => 16, 'C' => 28, 'D' => 18, 'E' => 14, 'F' => 16, 'G' => 18,
        ];
        $this->currencyColumns = ['F'];
        $this->quantityColumns = ['E'];
    }

    public function query()
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query;
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'Nama', 'No. HP', 'Email', 'Kota', 'Total Pesanan', 'Total Belanja', 'Terdaftar',
        ]);
    }

    public function map($customer): array
    {
        $metrics = app(CustomerService::class)->metricsFor($customer);

        return array_map([ExportSafety::class, 'cell'], [
            $customer->name,
            $customer->phone,
            $customer->email,
            $customer->default_city,
            $metrics['order_count'] ?? 0,
            (float) ($metrics['total_spent'] ?? 0),
            $this->formatWib($customer->created_at, 'd M Y'),
        ]);
    }
}
