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

        return Order::query()
            ->with('payments')
            ->with(['returnCases' => fn ($q) => $q->where('status', 'completed')->whereNotNull('completed_at')->whereBetween('completed_at', [$fromDate.' 00:00:00', $toDate.' 23:59:59'])])
            ->with('items:order_id,parent_sku,quantity')
            ->withCount('items')
            ->whereIn('order_status', $statuses)
            ->whereDate('created_at', '>=', $fromDate)
            ->whereDate('created_at', '<=', $toDate)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(function (Order $order) {
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
                $shippingRaw = $shippingNet + $shippingSubsidy + $insurance;
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
