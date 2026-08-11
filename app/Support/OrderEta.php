<?php

namespace App\Support;

use App\Models\Order;
use Carbon\Carbon;

/**
 * Estimasi waktu tiba pesanan: waktu produksi (konfigurasi) ditambah
 * rentang hari pengiriman (fallback lokal sampai SLA kurir tersimpan).
 *
 * config/shipping.php → eta = { production_days, delivery_min_days, delivery_max_days }
 */
class OrderEta
{
    public static function productionDays(): int
    {
        return max(0, (int) config('shipping.eta.production_days', 1));
    }

    public static function deliveryRange(): array
    {
        return [
            'min_days' => max(1, (int) config('shipping.eta.delivery_min_days', 2)),
            'max_days' => max(1, (int) config('shipping.eta.delivery_max_days', 5)),
        ];
    }

    /**
     * @return array{
     *   production_days: int,
     *   min_days: int,
     *   max_days: int,
     *   range_label: string,
     *   start_at: string,
     *   end_at: string
     * }
     */
    public static function forOrder(?Order $order = null): array
    {
        $base = $order?->created_at ? Carbon::parse($order->created_at) : now();
        $production = self::productionDays();
        ['min_days' => $minDays, 'max_days' => $maxDays] = self::deliveryRange();

        $start = $base->copy()->addDays($production + $minDays)->startOfDay();
        $end = $base->copy()->addDays($production + $maxDays)->endOfDay();

        $sameMonth = $start->format('m') === $end->format('m');
        $startLabel = $start->translatedFormat('j M');
        $endLabel = $sameMonth
            ? $end->translatedFormat('j M Y')
            : $end->translatedFormat('j M Y');

        return [
            'production_days' => $production,
            'min_days' => $minDays,
            'max_days' => $maxDays,
            'range_label' => "{$startLabel} – {$endLabel}",
            'start_at' => $start->toIso8601String(),
            'end_at' => $end->toIso8601String(),
        ];
    }

    /** Teks satu baris untuk parameter template WhatsApp. */
    public static function whatsappLabel(?Order $order = null): string
    {
        $eta = self::forOrder($order);

        return 'Estimasi tiba '.$eta['range_label']
            .' (termasuk '.$eta['production_days'].' hari produksi)';
    }
}
