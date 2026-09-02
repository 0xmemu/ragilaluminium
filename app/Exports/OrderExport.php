<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Order;
use App\Support\ExportSafety;
use App\Support\OrderEventLabels;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

/**
 * Export pesanan per-baris item produk (kontrak owner 2026-09-02, dari
 * Template_Order_Export.xlsx). 1 baris = 1 item produk; pesanan multi
 * produk menghasilkan beberapa baris dengan NO. ORDER + pelanggan sama.
 * Kolom uang LEVEL ORDER (ongkir, subsidi, biaya COD, refund, ongkir
 * retur) tampil SEKALI di baris item pertama per pesanan; baris item
 * berikutnya "-" (revisi owner 2026-09-02: biaya COD berlaku per
 * pengiriman/pesanan, bukan per produk).
 */
class OrderExport extends RagilStyledExport implements FromCollection, WithHeadings
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Laporan Pesanan';
        $this->columnWidths = [
            'A' => 18, 'B' => 16, 'C' => 14, 'D' => 18, 'E' => 18,
            'F' => 18, 'G' => 20, 'H' => 18, 'I' => 14, 'J' => 12,
            'K' => 13, 'L' => 10, 'M' => 13, 'N' => 14, 'O' => 14,
            'P' => 14, 'Q' => 12, 'R' => 12, 'S' => 16, 'T' => 20,
            'U' => 20, 'V' => 16, 'W' => 10, 'X' => 16, 'Y' => 18,
            'Z' => 18, 'AA' => 16, 'AB' => 34,
        ];
        // HARGA (J), DISKON PRODUK (M), ONGKOS KIRIM (O), SUBSIDI ONGKIR (P),
        // BIAYA COD (Q), REFUND (R), ONGKIR RETUR (S)
        $this->currencyColumns = ['J', 'M', 'O', 'P', 'Q', 'R', 'S'];
        $this->quantityColumns = ['I', 'K'];
    }

    /**
     * @param  Builder  $query  query Order hasil filter halaman Orders.
     *                          Dipetakan ke per-item rows di sini supaya
     *                          filter/limit tetap mengikat di level Order.
     */
    public function collection()
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        $orders = (clone $this->query)
            ->with([
                'items:id,order_id,parent_sku,variant_sku,name,variation_1_name,variation_1_option,variation_2_name,variation_2_option,unit_price,quantity,line_discount,discount_source',
                'items.productVariant:id,weight_kg,width_cm,height_cm,depth_cm',
                'payments:id,order_id,status,paid_at',
                'shippingRecords:id,order_id,waybill_number',
                'returnCases:id,order_id,status,resolution_type,reason,refund_amount,additional_shipping_amount',
            ])
            ->get();

        $rows = [];
        foreach ($orders as $order) {
            $paidAt = $order->payments
                ->firstWhere('status', 'completed')?->paid_at;
            $waybill = $order->shippingRecords->first()->waybill_number ?? '-';

            // Refund terjadi HANYA dari retur yang sudah selesai
            // (return case completed). Retur berjalan = refund 0.
            $completedCase = $order->returnCases->firstWhere('status', 'completed');
            $runningCase = $order->returnCases->firstWhere('status', 'open');
            $refund = (float) ($completedCase->refund_amount ?? 0);
            $returOngkir = (float) ($completedCase->additional_shipping_amount ?? 0);
            $returnType = '-';
            if ($runningCase) {
                $returnType = 'Retur diproses ('.($runningCase->reason ?? '-').')';
            } elseif ($completedCase) {
                $rt = $completedCase->resolution_type === 'replacement' ? 'Ganti barang' : 'Refund';
                $returnType = $rt.' ('.($completedCase->reason ?? '-').')';
            } elseif ($order->order_status === 'cancelled') {
                $returnType = 'Pesanan dibatalkan';
            }

            foreach ($order->items->values() as $index => $item) {
                $rowNum = count($rows) + 2;
                $variant = $item->productVariant;
                $dims = [$variant?->width_cm, $variant?->height_cm, $variant?->depth_cm];
                $volume = collect($dims)->every(fn ($d) => (float) $d > 0)
                    ? round((float) $dims[1]).' x '.round((float) $dims[0]).' x '.round((float) $dims[2]).' cm'
                    : '-';
                $variations = collect([
                    $item->variation_1_name ? $item->variation_1_name.': '.$item->variation_1_option : null,
                    $item->variation_2_name ? $item->variation_2_name.': '.$item->variation_2_option : null,
                ])->filter()->implode(', ');

                $rows[] = [
                    $order->order_number,
                    OrderEventLabels::orderStatus($order->order_status),
                    $this->formatWib($order->created_at, 'Y-m-d H:i:s'),
                    $paidAt ? $this->formatWib($paidAt, 'Y-m-d H:i:s') : '-',
                    $returnType,
                    $item->variant_sku ?: $item->parent_sku,
                    $item->name,
                    $variations !== '' ? $variations : '-',
                    (int) $item->quantity,
                    (float) $item->unit_price,
                    $variant && (float) $variant->weight_kg > 0
                        ? round((float) $variant->weight_kg * $item->quantity, 2)
                        : '-',
                    $volume,
                    (float) $item->line_discount,
                    $item->discount_source === 'flashsale' ? 'Flashsale' : 'Reguler',
                    $index === 0 ? (float) $order->shipping_amount : '-',
                    $index === 0 ? (float) $order->shipping_subsidy_amount : '-',
                    $index === 0 ? (float) $order->cod_fee_amount : '-',
                    $index === 0 ? $refund : '-',
                    $index === 0 ? $returOngkir : '-',
                    $waybill,
                    $order->customer_name,
                    $order->customer_phone,
                    $order->shipping_postal_code,
                    $order->shipping_province,
                    $order->shipping_city,
                    $order->shipping_district ?: '-',
                    $order->shipping_village ?: '-',
                    trim(($order->shipping_address_line1 ?? '').' '.($order->shipping_address_line2 ?? '')),
                ];
                $this->trackZeroCells($rows[count($rows) - 1], $rowNum);
            }
        }

        return collect($rows);
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'NO. ORDER', 'ORDER STATUS', 'DIPESAN SAAT', 'DIBAYAR SAAT',
            'Cancelation/Return Type', 'SKU ID', 'NAMA PRODUK', 'VARIASI',
            'QTY', 'HARGA', 'BERAT(KG)', 'VOLUME', 'DISKON PRODUK',
            'TYPE DISKON', 'ONGKOS KIRIM', 'SUBSIDI ONGKIR', 'BIAYA COD',
            'REFUND', 'ONGKIR RETUR DITANGGUNG TOKO', 'NOMOR RESI',
            'NAMA PELANGGAN', 'NO. WA', 'KODE POS', 'PROVINSI',
            'KABUPATEN/KOTA', 'KECAMATAN', 'DESA', 'ALAMAT LENGKAP',
        ]);
    }

}
