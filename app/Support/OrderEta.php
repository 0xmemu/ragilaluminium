<?php

namespace App\Support;

use App\Models\Order;
use Carbon\Carbon;

/**
 * Display ETA: production + carrier range + configured display buffer.
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

    public static function deliveryRange(): array
    {
        $settings = OperationalSettings::current(OperationalSettings::ETA);
        $min = max(1, (int) ($settings['delivery_min_days'] ?? config('shipping.eta.delivery_min_days', 2)));
        $max = max($min, (int) ($settings['delivery_max_days'] ?? config('shipping.eta.delivery_max_days', 5)));
        $buffer = self::displayBufferDays();

        return [
            'min_days' => $min + $buffer,
            'max_days' => $max + $buffer,
        ];
    }

    /**
     * @return array{production_days: int, min_days: int, max_days: int, display_buffer_days: int, range_label: string, start_at: string, end_at: string}
     */
    public static function forOrder(?Order $order = null): array
    {
        $base = $order?->created_at ? Carbon::parse($order->created_at) : now();
        $production = self::productionDays();
        ['min_days' => $minDays, 'max_days' => $maxDays] = self::deliveryRange();

        $start = $base->copy()->addDays($production + $minDays)->startOfDay();
        $end = $base->copy()->addDays($production + $maxDays)->endOfDay();
        $startLabel = $start->translatedFormat('j M');
        $endLabel = $end->translatedFormat('j M Y');

        return [
            'production_days' => $production,
            'min_days' => $minDays,
            'max_days' => $maxDays,
            'display_buffer_days' => self::displayBufferDays(),
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
