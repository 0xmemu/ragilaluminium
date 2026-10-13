<?php

namespace App\Support;

use App\Models\Order;
use Carbon\Carbon;

/**
 * Display ETA: production + carrier range + configured display buffer.
 *
 * deliveryRange() is the raw/internal provider range. forOrder() is the
 * single customer-facing presentation boundary and applies the display
 * buffer exactly once.
 */
class OrderEta
{
    public static function productionDays(): int
    {
        $settings = OperationalSettings::current(OperationalSettings::ETA);

        return max(0, (int) ($settings['production_days'] ?? config('shipping.eta.production_days', 1)));
    }

    public static function displayBufferDays(): int
    {
        $settings = OperationalSettings::current(OperationalSettings::ETA);

        return max(0, (int) ($settings['display_buffer_days'] ?? config('shipping.eta.display_buffer_days', 1)));
    }

    /**
     * Raw system/provider delivery range. No presentation buffer is applied.
     *
     * @return array{min_days:int,max_days:int}
     */
    public static function deliveryRange(): array
    {
        $settings = OperationalSettings::current(OperationalSettings::ETA);
        $min = max(1, (int) ($settings['delivery_min_days'] ?? config('shipping.eta.delivery_min_days', 2)));
        $max = max($min, (int) ($settings['delivery_max_days'] ?? config('shipping.eta.delivery_max_days', 5)));

        return [
            'min_days' => $min,
            'max_days' => $max,
        ];
    }

    /**
     * @return array{production_days:int,min_days:int,max_days:int,base_min_days:int,base_max_days:int,display_buffer_days:int,range_label:string,start_at:string,end_at:string}
     */
    public static function forOrder(?Order $order = null): array
    {
        $base = $order?->created_at ? Carbon::parse($order->created_at) : now();
        $production = self::productionDays();
        $raw = self::deliveryRange();
        $buffer = self::displayBufferDays();
        $minDays = $raw['min_days'] + $buffer;
        $maxDays = $raw['max_days'] + $buffer;

        $start = $base->copy()->addDays($production + $minDays)->startOfDay();
        $end = $base->copy()->addDays($production + $maxDays)->endOfDay();
        $startLabel = $start->translatedFormat('j M');
        $endLabel = $end->translatedFormat('j M Y');

        return [
            'production_days' => $production,
            'min_days' => $minDays,
            'max_days' => $maxDays,
            'base_min_days' => $raw['min_days'],
            'base_max_days' => $raw['max_days'],
            'display_buffer_days' => $buffer,
            'range_label' => "{$startLabel} – {$endLabel}",
            'start_at' => $start->toIso8601String(),
            'end_at' => $end->toIso8601String(),
        ];
    }

    public static function whatsappLabel(?Order $order = null): string
    {
        $eta = self::forOrder($order);

        return 'Estimasi tiba '.$eta['range_label'].' (termasuk '.$eta['production_days'].' hari produksi)';
    }
}
