<?php

namespace App\Support;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\StorePerformanceService;

/**
 * Sumber data sheet Income Detail + Item Terjual pada export Performa Toko.
 *
 * Kontrak:
 * - Rentang mengikuti rentang laporan performa (dari from_date s.d. to_date),
 *   banding `created_at` pesanan (rule omzet: pengakuan sejak pesanan dibuat).
 * - Pesanan scope omzet (REVENUE_STATUSES, selaras StorePerformanceService)
 *   PLUS pesanan Dibatalkan sebagai baris konteks bernilai uang NOL semua
 *   (keputusan owner 2026-09-13): status dan identitasnya terlihat, tetapi
 *   tidak mengubah satu pun total Laba Rugi. Agregat pembatalan tetap di
 *   KPI (jumlah, nilai, rasio) yang sumbernya service, bukan tabel ini.
 * - 1 baris Income Detail = 1 pesanan; 1 baris Item Terjual = 1 item pesanan
 *   (Tabel Item tetap scope omzet saja, tanpa baris batal).
 * - Semua nilai dari snapshot order (subtotal, diskon, voucher, ongkir, COD,
 *   asuransi), bukan perhitungan ulang.
 */
class IncomeDetailQuery
{
    /** @return list<array<string, mixed>> */
    public static function orders(string $fromDate, string $toDate): array
    {
        // Scope omzet + cancelled (konteks performa; nilainya dinolkan di bawah).
        $statuses = array_merge(
            StorePerformanceService::REVENUE_STATUSES,
            ['cancelled'],
        );

        $orders = Order::query()
            ->with('payments')
            ->with(['returnCases' => fn ($q) => $q->where('status', 'completed')->whereNotNull('completed_at')->whereBetween('completed_at', [$fromDate.' 00:00:00', $toDate.' 23:59:59'])])
            ->with('items:order_id,parent_sku,quantity')
            ->withCount('items')
            ->whereIn('order_status', $statuses)
            ->whereDate('created_at', '>=', $fromDate)
            ->whereDate('created_at', '<=', $toDate)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        // Ongkir ASLI dari konsol J&T per pesanan (satu query untuk semua baris).
        $actualOngkir = ShippingRecord::actualOngkirByOrder($orders->pluck('id')->all());

        return $orders
            ->map(function (Order $order) use ($actualOngkir) {
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
                // Asuransi juga dipotong J&T, jadi bagian dari shipping_raw.
                $insurance = (float) $order->shipping_insurance_amount;
                // Tagihan J&T: pakai angka ASLI dari J&T (totalFreight, diisi
                // otomatis dari pelacakan resi) bila sudah ada; kalau belum,
                // pakai asumsi checkout supaya pesanan lama tidak berubah.
                // Asumsi = ongkir pembeli + subsidi toko + asuransi, SEBANDING
                // dengan totalFreight yang juga sudah memuat asuransi, supaya
                // tidak ada asuransi terhitung dua kali.
                $assumedOngkir = $shippingNet + $shippingSubsidy + $insurance;
                $actualOngkirOrder = $actualOngkir[$order->id] ?? null;
                $shippingRaw = $actualOngkirOrder ?? $assumedOngkir;
                $codFee = (float) $order->cod_fee_amount;
                $refund = (float) $order->returnCases->sum('refund_amount');
                $returnShippingStore = (float) $order->returnCases->sum('return_shipping_cost');
                $gross = $totalPaidByCustomer;
                $net = $gross - $shippingRaw - $codFee - $refund - $returnShippingStore;

                $row = [
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
                    'net_revenue' => $net,
                    'insurance' => (float) $order->shipping_insurance_amount,
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

                // Pesanan Dibatalkan: seluruh nilai uang dan jumlah = 0 supaya
                // SUM/SUBTOTAL Tabel Pesanan identik dengan metrik service
                // (KPI). Baris tetap tampil sebagai konteks pembatalan; qty
                // dan jenis SKU ikut nol agar baris JUMLAH tidak bergeser.
                if ($order->order_status === 'cancelled') {
                    foreach ([
                        'subtotal_before_discount', 'discount', 'voucher_discount',
                        'gross_revenue', 'shipping_raw', 'jnt_ongkir_assumed',
                        'jnt_ongkir_actual', 'jnt_ongkir_selisih', 'shipping_subsidy',
                        'shipping_net_paid_by_customer', 'cod_fee', 'refund_amount',
                        'return_shipping_store', 'net_revenue', 'insurance',
                        'total_paid_by_customer', 'paid_amount', 'outstanding',
                        'items_count', 'total_qty', 'sku_count',
                    ] as $moneyKey) {
                        $row[$moneyKey] = 0;
                    }
                    $row['paid_at'] = null;
                }

                return $row;
            })
            ->all();
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
