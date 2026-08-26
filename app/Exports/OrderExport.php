<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Order;
use App\Support\ExportSafety;
use App\Support\OrderEventLabels;
use App\Support\OrderStatusView;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class OrderExport extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Laporan Pesanan';
        $this->columnWidths = [
            'A' => 18, 'B' => 24, 'C' => 16, 'D' => 16, 'E' => 16,
            'F' => 20, 'G' => 22, 'H' => 16, 'I' => 16, 'J' => 12, 'K' => 12, 'L' => 20,
        ];
        $this->currencyColumns = ['I'];
        $this->quantityColumns = ['J', 'K'];
    }

    public function query()
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query;
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'No. Pesanan', 'Nama Pelanggan', 'No. HP', 'Kota', 'Provinsi',
            'Status Pesanan', 'Status Pembayaran', 'Metode Bayar', 'Total',
            'Jumlah Item', 'Satuan', 'Tanggal',
        ]);
    }

    public function map($order): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            $order->order_number,
            $order->customer_name,
            $order->customer_phone,
            $order->shipping_city,
            $order->shipping_province,
            OrderEventLabels::orderStatus($order->order_status),
            OrderStatusView::paymentLabel($order),
            $this->paymentMethodLabel($order),
            (float) $order->total_amount,
            $order->items_count,
            $order->units_count,
            $this->formatWib($order->created_at),
        ]);
    }

    protected function paymentMethodLabel(Order $order): string
    {
        $method = strtolower((string) ($order->payment_method ?? ''));

        if ($method === 'cod' || $order->cod_flag) {
            return 'COD';
        }
        if ($method === 'qris') {
            return 'QRIS';
        }
        if (in_array($method, ['va', 'virtual_account'], true)) {
            return 'Virtual Account';
        }
        if ($method === 'transfer') {
            return 'Transfer Bank';
        }

        return $method !== '' ? ucwords(str_replace('_', ' ', $method)) : 'Transfer Bank';
    }
}
