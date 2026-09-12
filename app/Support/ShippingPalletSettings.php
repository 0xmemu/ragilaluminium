<?php

namespace App\Support;

class ShippingPalletSettings
{
    public const SETTING_KEY = 'shipping_pallet';

    public const DEFAULTS = [
        'allowance_per_side_cm' => 3.0,
    ];

    public static function get(): array
    {
        $versioned = OperationalSettings::current(self::SETTING_KEY);

        return is_array($versioned)
            ? self::normalize($versioned)
            : self::DEFAULTS;
    }

    public static function normalize(array $settings): array
    {
        return [
            'allowance_per_side_cm' => max(0, (float) ($settings['allowance_per_side_cm'] ?? self::DEFAULTS['allowance_per_side_cm'])),
        ];
    }

    public static function update(array $settings, ?int $adminId = null, array $audit = []): array
    {
        $normalized = self::normalize($settings);
        OperationalSettings::record(
            self::SETTING_KEY,
            $normalized,
            $adminId,
            $audit['source'] ?? 'admin',
            $audit['reason'] ?? null,
            $audit['reference_type'] ?? null,
            $audit['reference_id'] ?? null,
        );
        return $normalized;
    }

    public static function allowancePerSideCm(): float
    {
        return self::get()['allowance_per_side_cm'] ?? 3.0;
    }
}
