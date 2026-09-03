<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Order;
use App\Support\ExportSafety;
use App\Support\OrderEventLabels;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

/**
 * Export pesanan per-baris item produk (kontrak owner 2026-09-02, dari
 * Template_Order_Export.xlsx). 1 baris = 1 item produk; pesanan multi
 * produk menghasilkan beberapa baris dengan NO. ORDER + pelanggan sama.
 *
 * Biaya level pesanan (revisi owner 2026-09-02): SEMUA kolom biaya
 * (shipping_amount, shipping_subsidy_amount, cod_fee_amount, refund_amount,
 * additional_shipping_amount) dibagi RATA per unit (qty item / total unit,
 * satu baris per produk, kolom qty), sistemnya mirip biaya COD.
 * PENGHASILAN BERSIH per item = (harga x qty) - diskon produk - (bagian rata
 * per unit subsidi + COD + refund + ongkir retur). Ongkir TIDAK mengurangi
 * karena dibayar pembeli. Ada refund/ongkir retur -> net otomatis mengecil.
 * Format angka POLOS tanpa "Rp" (nilai sel tetap numerik, bisa dibaca
 * Excel/tools). Header kolom memakai NAMA SISTEM (kunci DB snake_case,
 * mis. paid_at, variant_sku, cod_fee_amount) supaya mudah dikenali dan
 * diproses, bukan label karangan. Penjelasan aturan ada di sheet Panduan.
 */
class OrderExport implements WithMultipleSheets
{
    public function __construct(protected Builder $query)
    {
    }

    public function sheets(): array
    {
        return [
            new OrderExportDataSheet($this->query),
            new OrderExportGuideSheet(),
        ];
    }
}

// ------ DATA (sheet pertama, per-item rows) ------

class OrderExportDataSheet extends RagilStyledExport implements FromCollection, WithHeadings
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Laporan Pesanan';
        $this->columnWidths = [
            'A' => 18, 'B' => 16, 'C' => 14, 'D' => 18, 'E' => 18,
            'F' => 18, 'G' => 20, 'H' => 18, 'I' => 14, 'J' => 12,
            'K' => 13, 'L' => 10, 'M' => 13, 'N' => 14, 'O' => 14,
            'P' => 14, 'Q' => 12, 'R' => 12, 'S' => 16, 'T' => 16,
            'U' => 20, 'V' => 20, 'W' => 16, 'X' => 10, 'Y' => 16,
            'Z' => 18, 'AA' => 18, 'AB' => 16, 'AC' => 34,
        ];
        // HARGA (J), DISKON PRODUK (M), ONGKOS KIRIM (O), SUBSIDI ONGKIR (P),
        // BIAYA COD (Q), REFUND (R), ONGKIR RETUR (S), PENGHASILAN BERSIH (T)
        $this->currencyColumns = ['J', 'M', 'O', 'P', 'Q', 'R', 'S', 'T'];
        $this->quantityColumns = ['I', 'K'];
        // Format polos tanpa "Rp": minimal human error, pivot-friendly, tetap numerik.
        $this->currencyFormat = '#,##0';
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
                'items:id,order_id,product_variant_id,parent_sku,variant_sku,name,variation_1_name,variation_1_option,variation_2_name,variation_2_option,unit_price,quantity,line_discount,discount_source',
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

            // Biaya level pesanan: dibagi per item (COD/refund rata per unit,
            // ongkir/subsidi/ongkir retur proporsional berat, lihat docblock).
            $orderShipping = (float) $order->shipping_amount;
            $orderSubsidy = (float) $order->shipping_subsidy_amount;
            $orderCod = (float) $order->cod_fee_amount;
            $totalQty = max(1, (int) $order->items->sum('quantity'));

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

                $itemValue = (float) $item->unit_price * (int) $item->quantity;
                $qty = max(1, (int) $item->quantity);
                $qtyRatio = $qty / $totalQty;
                // Semua biaya order dibagi rata per unit (aturan owner).
                $shareShipping = $orderShipping * $qtyRatio;
                $shareSubsidy = $orderSubsidy * $qtyRatio;
                $shareCod = $orderCod * $qtyRatio;
                $shareRefund = $refund * $qtyRatio;
                $shareReturOngkir = $returOngkir * $qtyRatio;
                // Nilai mentah tanpa round: pembulatan dilakukan format tampilan,
                // supaya SUM Excel = total net pesanan eksak.
                $netIncome = $itemValue - (float) $item->line_discount
                    - ($shareSubsidy + $shareCod + $shareRefund + $shareReturOngkir);

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
                    $shareShipping,
                    $shareSubsidy,
                    $shareCod,
                    $shareRefund,
                    $shareReturOngkir,
                    $netIncome,
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
            'order_number', 'order_status', 'created_at', 'paid_at',
            'return_case', 'variant_sku', 'name', 'variation',
            'quantity', 'unit_price', 'weight_kg', 'volume', 'line_discount',
            'discount_source', 'shipping_amount', 'shipping_subsidy_amount', 'cod_fee_amount',
            'refund_amount', 'additional_shipping_amount', 'net_income',
            'waybill_number', 'customer_name', 'customer_phone', 'shipping_postal_code', 'shipping_province',
            'shipping_city', 'shipping_district', 'shipping_village', 'shipping_address',
        ]);
    }
}

// ------ PANDUAN (sheet kedua, penjelasan aturan) ------

class OrderExportGuideSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['PANDUAN EXPORT PESANAN', 'Ragil Aluminium'],
            [],
            ['ATURAN BARIS', 'Setiap baris = 1 item produk. Pesanan dengan beberapa produk menjadi beberapa baris dengan NO. ORDER dan data pelanggan yang sama.'],
            ['PEMBAGIAN BIAYA', 'SEMUA kolom biaya (shipping_amount, shipping_subsidy_amount, cod_fee_amount, refund_amount, additional_shipping_amount) dibagi RATA per unit: bagian = biaya total x qty item / total unit, satu baris per produk dengan kolom qty. Contoh (owner): ongkir 100.000 untuk 2 produk -> 50.000 per produk; subsidi 10% (10.000) -> 5.000 per produk. Tarif ongkir J&T tetap dihitung SEKALI dari total berat semua produk (ShippingService::cartWeightKg); pembagian per unit hanya tampilan laporan, jumlah kolom = tarif pesanan. Jumlah tiap kolom di semua baris = nilai pesanan.'],
            ['PENGHASILAN BERSIH', 'Per item: (unit_price x quantity) - line_discount - (bagian shipping_subsidy_amount + bagian cod_fee_amount + bagian refund_amount + bagian additional_shipping_amount), semua dibagi rata per unit. Ada refund atau ongkir retur -> net otomatis mengecil. Ongkos kirim (shipping_amount) tidak dikurangi karena dibayar pembeli. Jumlah kolom = total nilai pesanan dikurangi diskon, subsidi, COD, refund, dan ongkir retur.'],
            ['FORMAT ANGKA', 'Semua kolom uang memakai angka polos tanpa "Rp" (contoh: 3.000.000). Nilai sel tetap numerik, aman dijumlah dan bisa dibaca Excel maupun tools lain.'],
            ['NAMA KOLOM', 'Header memakai nama sistem (kunci DB snake_case): order_number, created_at, paid_at, variant_sku, unit_price, quantity, shipping_amount, cod_fee_amount, refund_amount, net_income, waybill_number, customer_name, customer_phone, shipping_*. Tujuannya supaya sistem/tools bisa mengenali kolom tanpa penerjemahan.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $last = $sheet->getHighestRow();
        $sheet->getStyle('A3:B'.$last)->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        for ($r = 3; $r <= $last; $r++) {
            $sheet->getStyle('A'.$r)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFC20000']],
            ]);
        }

        $sheet->getColumnDimension('A')->setWidth(26);
        $sheet->getColumnDimension('B')->setWidth(100);
    }
}