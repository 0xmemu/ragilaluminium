<?php

namespace App\Support;

/**
 * Pengaturan pallet pengiriman (allowance per sisi, cm).
 *
 * Sengaja TANPA halaman admin: nilainya stabil dan dipakai selamanya.
 * Ubah lewat config/shipping.php atau env SHIPPING_PALLET_ALLOWANCE_CM.
 */
class ShippingPalletSettings
{
    public const DEFAULT_ALLOWANCE_PER_SIDE_CM = 3.0;

    public static function allowancePerSideCm(): float
    {
        $value = config('shipping.pallet_allowance_per_side_cm', self::DEFAULT_ALLOWANCE_PER_SIDE_CM);

        if (! is_numeric($value)) {
            return self::DEFAULT_ALLOWANCE_PER_SIDE_CM;
        }

        return max(0.0, (float) $value);
    }
}
