<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Customer;
use App\Models\Order;
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
            'A' => 16, // ID Pelanggan
            'B' => 24, // Nama
            'C' => 18, // No. WhatsApp
            'D' => 36, // Nomor Pesanan
            'E' => 36, // Alamat
            'F' => 18, // Kota
            'G' => 18, // Provinsi
            'H' => 14, // Status
            'I' => 14, // Total Pesanan
            'J' => 18, // Total Belanja
            'K' => 16, // Terdaftar
        ];
        $this->currencyColumns = ['J'];
        $this->quantityColumns = ['I'];
        // No. WhatsApp adalah identitas: sebagai angka, Excel menampilkan
        // 2,62857E+12 dan nomor 16+ digit bisa dibulatkan.
        $this->textColumns = ['C'];
    }

    public function query()
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query;
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'ID Pelanggan',
            'Nama',
            'No. WhatsApp',
            'Nomor Pesanan',
            'Alamat',
            'Kota',
            'Provinsi',
            'Status',
            'Total Pesanan',
            'Total Belanja',
            'Terdaftar',
        ]);
    }

    public function map($customer): array
    {
        $metrics = app(CustomerService::class)->metricsFor($customer);
        $orderNumbers = Order::query()
            ->where('customer_phone', $customer->phone)
            ->orderBy('id')
            ->pluck('order_number')
            ->filter()
            ->implode(', ');

        $address = collect([
            $customer->default_address_line1,
            $customer->default_address_line2,
        ])->filter()->implode(', ');

        return array_map([ExportSafety::class, 'cell'], [
            app(CustomerService::class)->publicCode($customer),
            $customer->name,
            $customer->phone,
            $orderNumbers !== '' ? $orderNumbers : '-',
            $address !== '' ? $address : ($customer->default_city ?? '-'),
            $customer->default_city ?? '-',
            $customer->default_province ?? '-',
            $metrics['status']['label'] ?? 'Baru',
            $metrics['order_count'] ?? 0,
            (float) ($metrics['total_spent'] ?? 0),
            $this->formatWib($customer->created_at, 'd M Y'),
        ]);
    }
}
