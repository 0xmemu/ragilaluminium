<?php

namespace App\Support;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\StorePerformanceService;
use Illuminate\Support\Carbon;

/**
 * Sumber data sheet Income Detail + Item Terjual pada export Performa Toko.
 *
 * Kontrak:
 * - Rentang mengikuti rentang laporan performa (dari from_date s.d. to_date).
 * - Himpunan pesanan yang dihitung SAMA dengan himpunan pengakuan
 *   StorePerformanceService (pesanan DIBUAT dalam rentang DAN tercatat
 *   mencapai Diproses paling lambat akhir rentang). Baris pesanan di luar
 *   himpunan itu tetap tampil sebagai konteks, tetapi seluruh nilai uangnya
 *   NOL, supaya SUM kolom uang Tabel Pesanan tidak pernah berbeda dari KPI
 *   PENJUALAN GROSS / PENJUALAN BERSIH di sheet Ringkasan dan di layar.
 * - Pesanan Dibatalkan ikut sebagai baris konteks bernilai nol (keputusan
 *   owner 2026-09-13): status dan identitasnya terlihat, tetapi tidak
 *   mengubah satu pun total Laba Rugi. Pesanan yang dibatalkan SETELAH
 *   mencapai Diproses tetap dihitung (pengakuan penjualan dibekukan), jadi
 *   penolakan nilai mengikuti himpunan pengakuan, bukan status akhir.
 * - Refund dan ongkir retur mengikuti TANGGAL SELESAI RETUR, sama seperti
 *   service. Karena itu pesanan lama yang returnya selesai pada rentang ini
 *   ditambahkan sebagai baris koreksi periode (hanya berisi refund dan ongkir
 *   retur), supaya SUM kolom sama dengan KPI tanpa menghitung pesanan lama
 *   itu ke dalam penjualan periode ini.
 * - 1 baris Income Detail = 1 pesanan; 1 baris Item Terjual = 1 item pesanan
 *   (Tabel Item tetap scope omzet saja, tanpa baris batal).
 * - Semua nilai dari snapshot order (subtotal, diskon, voucher, ongkir, COD,
 *   asuransi), bukan perhitungan ulang.
 */
class IncomeDetailQuery
{
    /** Kunci nilai uang dan jumlah yang dinolkan pada baris konteks. */
    private const MONEY_KEYS = [
        'subtotal_before_discount', 'discount', 'voucher_discount',
        'gross_revenue', 'shipping_raw', 'jnt_ongkir_assumed',
        'jnt_ongkir_actual', 'jnt_ongkir_selisih', 'shipping_subsidy',
        'shipping_net_paid_by_customer', 'cod_fee', 'refund_amount',
        'return_shipping_store', 'refused_goods_value', 'net_revenue',
        'insurance', 'total_paid_by_customer', 'paid_amount', 'outstanding',
        'items_count', 'total_qty', 'sku_count',
    ];

    /** @return list<array<string, mixed>> */
    public static function orders(string $fromDate, string $toDate): array
    {
        $from = Carbon::parse($fromDate)->startOfDay();
        $to = Carbon::parse($toDate)->endOfDay();

        // Himpunan pengakuan dibaca dari service supaya kedua permukaan tidak
        // bisa berbeda. Service yang sama juga dipakai layar Performa Toko.
        $recognized = array_flip(
            app(StorePerformanceService::class)->recognizedOrderIds($from, $to)
        );

        // Scope omzet + cancelled (konteks performa; nilainya dinolkan di bawah).
        $statuses = array_merge(
            StorePerformanceService::REVENUE_STATUSES,
            ['cancelled'],
        );

        $orders = Order::query()
            ->with('payments')
            ->with(['returnCases' => fn ($q) => $q->where('status', 'completed')->whereNotNull('completed_at')->whereBetween('completed_at', [$from, $to])])
            ->with('items:order_id,parent_sku,quantity')
            ->withCount('items')
            ->whereIn('order_status', $statuses)
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        // Ongkir ASLI dari konsol J&T per pesanan (satu query untuk semua baris).
        $actualOngkir = ShippingRecord::actualOngkirByOrder($orders->pluck('id')->all());

        $rows = $orders
            ->map(function (Order $order) use ($actualOngkir, $recognized) {
                $row = self::snapshotRow($order, $actualOngkir[$order->id] ?? null);

                // Pesanan di luar himpunan pengakuan periode ini: seluruh nilai
                // uang dan jumlah = 0 supaya SUM/SUBTOTAL Tabel Pesanan identik
                // dengan metrik service (KPI). Baris tetap tampil sebagai
                // konteks; qty dan jenis SKU ikut nol agar baris JUMLAH tidak
                // bergeser.
                if (! isset($recognized[$order->id])) {
                    $row = self::zeroed($row);
                }

                return $row;
            })
            ->all();

        return array_merge($rows, self::correctionRows(array_keys($recognized), $from, $to));
    }

    /**
     * Baris koreksi periode: pesanan yang DIBUAT di luar rentang tetapi
     * returnya SELESAI di dalam rentang. Nilai penjualannya nol (bukan
     * penjualan periode ini), hanya refund dan ongkir retur yang masuk, sama
     * seperti cara service menghitung kedua angka itu.
     *
     * @param  list<int>  $recognizedIds
     * @return list<array<string, mixed>>
     */
    private static function correctionRows(array $recognizedIds, Carbon $from, Carbon $to): array
    {
        $selesaiRentang = fn ($q) => $q->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to]);

        return Order::query()
            ->with(['returnCases' => $selesaiRentang])
            ->whereHas('returnCases', $selesaiRentang)
            ->when($recognizedIds !== [], fn ($q) => $q->whereNotIn('id', $recognizedIds))
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(function (Order $order) {
                $row = self::zeroed(self::snapshotRow($order, null));
                $refund = (float) $order->returnCases->sum('refund_amount');
                $returnShippingStore = (float) $order->returnCases->sum('return_shipping_cost');
                $row['refund_amount'] = $refund;
                $row['return_shipping_store'] = $returnShippingStore;
                $row['net_revenue'] = -1 * ($refund + $returnShippingStore);

                return $row;
            })
            ->all();
    }

    /**
     * Seluruh kolom uang dan jumlah satu pesanan dari snapshot order.
     *
     * @return array<string, mixed>
     */
    private static function snapshotRow(Order $order, ?float $actualOngkirOrder): array
    {
        $paidAmount = (float) $order->payments
            ->where('status', 'completed')
            ->sum('amount');
        $totalPaidByCustomer = (float) $order->total_amount;
        $latestPaidAt = $order->payments
            ->where('status', 'completed')
            ->sortByDesc('paid_at')
            ->first()?->paid_at;
        $shippingNet = (float) $order->shipping_amount;
        $shippingSubsidy = (float) $order->shipping_subsidy_amount;
        $insurance = (float) $order->shipping_insurance_amount;
        // Tarif checkout = ongkir pembeli + subsidi toko + asuransi, SEBANDING
        // dengan totalFreight J&T yang juga sudah memuat asuransi, supaya
        // tidak ada asuransi terhitung dua kali.
        $assumedOngkir = $shippingNet + $shippingSubsidy + $insurance;
        $shippingRaw = $actualOngkirOrder ?? $assumedOngkir;
        $codFee = (float) $order->cod_fee_amount;
        $refund = (float) $order->returnCases->sum('refund_amount');
        $returnShippingStore = (float) $order->returnCases->sum('return_shipping_cost');
        $gross = $totalPaidByCustomer;
        // Paket yang ditolak kurir sebelum lunas: nilai pesanannya keluar dari
        // Penjualan Bersih karena tidak ada uang masuk sama sekali. Syaratnya
        // sama dengan service (retur selesai dan pembayaran belum lunas).
        $refused = $order->order_status === 'return_completed' && $order->payment_status !== 'paid'
            ? (float) $order->total_amount
            : 0.0;
        $net = $gross - $shippingRaw - $codFee - $refund - $returnShippingStore - $refused;

        return [
            'order_number' => $order->order_number,
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $latestPaidAt?->toIso8601String(),
            // Metode mentah dari database. Pemberian label dilakukan
            // oleh pemakainya, supaya angka COUNTIFS tidak pernah
            // berbeda dengan teks yang ditampilkan.
            'payment_method' => $order->payment_method,
            'order_status' => $order->order_status,
            'payment_status' => $order->payment_status,
            'subtotal_before_discount' => (float) $order->subtotal_amount,
            'discount' => (float) $order->discount_amount,
            'voucher_discount' => (float) $order->voucher_discount_amount,
            'gross_revenue' => $gross,
            'shipping_raw' => $shippingRaw,
            'jnt_ongkir_assumed' => $assumedOngkir,
            'jnt_ongkir_actual' => $actualOngkirOrder,
            'jnt_ongkir_selisih' => $actualOngkirOrder !== null
                ? $actualOngkirOrder - $assumedOngkir
                : null,
            'shipping_subsidy' => $shippingSubsidy,
            'shipping_net_paid_by_customer' => $shippingNet,
            'cod_fee' => $codFee,
            'refund_amount' => $refund,
            'return_shipping_store' => $returnShippingStore,
            'refused_goods_value' => $refused,
            'net_revenue' => $net,
            'insurance' => $insurance,
            'total_paid_by_customer' => $totalPaidByCustomer,
            'paid_amount' => $paidAmount,
            'outstanding' => max(0.0, $totalPaidByCustomer - $paidAmount),
            'items_count' => (int) $order->items_count,
            'total_qty' => (int) $order->items->sum('quantity'),
            'sku_count' => $order->items->pluck('parent_sku')->filter()->unique()->count(),
            // Identitas pembeli untuk kolom W-Y Tabel Pesanan.
            'customer_name' => $order->customer_name,
            'customer_phone' => (string) $order->customer_phone,
            'city' => $order->shipping_city,
        ];
    }

    /**
     * Nolkan seluruh nilai uang dan jumlah pada satu baris konteks.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private static function zeroed(array $row): array
    {
        foreach (self::MONEY_KEYS as $moneyKey) {
            $row[$moneyKey] = 0;
        }
        $row['paid_at'] = null;

        return $row;
    }

    /** @return list<array<string, mixed>> */
    public static function items(string $fromDate, string $toDate): array
    {
        $statuses = StorePerformanceService::REVENUE_STATUSES;

        return Order::query()
            ->whereIn('order_status', $statuses)
            ->whereDate('created_at', '>=', $fromDate)
            ->whereDate('created_at', '<=', $toDate)
            ->with('items')
            ->get()
            ->flatMap(function (Order $order) {
                return $order->items->map(function ($item) use ($order) {
                    $variation = trim(implode(' / ', array_filter([
                        $item->variation_1_option,
                        $item->variation_2_option,
                    ])));

                    return [
                        'order_number' => $order->order_number,
                        'created_at' => $order->created_at?->toIso8601String(),
                        'parent_sku' => $item->parent_sku,
                        'name' => $item->name,
                        'variation' => $variation !== '' ? $variation : '-',
                        'unit_price' => (float) $item->unit_price,
                        'quantity' => (int) $item->quantity,
                        'line_total' => (float) $item->line_total,
                        'line_discount' => (float) $item->line_discount,
                    ];
                });
            })
            ->values()
            ->all();
    }
}
