<?php

namespace App\Support;

use App\Models\Order;
use Illuminate\Support\Carbon;

/**
 * Sumber data sheet Income Detail + Item Terjual pada export Performa Toko.
 *
 * Kontrak:
 * - Rentang mengikuti rentang laporan performa (dari from_date s.d. to_date),
 *   banding `created_at` pesanan (rule omzet: pengakuan sejak pesanan dibuat).
 * - Hanya pesanan yang masuk scope omzet (REVENUE_STATUSES, selaras StorePerformanceService).
 * - 1 baris Income Detail = 1 pesanan; 1 baris Item Terjual = 1 item pesanan.
 * - Semua nilai dari snapshot order (subtotal, diskon, voucher, ongkir, COD,
 *   asuransi), bukan perhitungan ulang.
 */
class IncomeDetailQuery
{
    /** @return list<array<string, mixed>> */
    public static function orders(string $fromDate, string $toDate): array
    {
        $statuses = \App\Services\StorePerformanceService::REVENUE_STATUSES;

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
        $actualOngkir = \App\Models\ShippingRecord::actualOngkirByOrder($orders->pluck('id')->all());

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

                return [
                    'order_number' => $order->order_number,
                    'created_at' => $order->created_at?->toIso8601String(),
                    'paid_at' => $latestPaidAt?->toIso8601String(),
                    'payment_method' => $order->payment_method === 'cod' ? 'COD' : 'Transfer',
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
                ];
            })
            ->all();
    }

    /** @return list<array<string, mixed>> */
    public static function items(string $fromDate, string $toDate): array
    {
        $statuses = \App\Services\StorePerformanceService::REVENUE_STATUSES;

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
