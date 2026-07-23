<?php

namespace App\Support;

/**
 * Normalisasi nomor telepon Indonesia ke format E.164 tanpa "+" (62xxxxxxxxxx),
 * dipakai konsisten untuk order lookup, WhatsApp, dan J&T.
 */
class PhoneNumber
{
    public static function normalize(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw);

        if ($digits === '' || $digits === null) {
            return null;
        }

        // 08xxxx -> 628xxxx
        if (str_starts_with($digits, '0')) {
            $digits = '62'.substr($digits, 1);
        } elseif (str_starts_with($digits, '620')) {
            $digits = '62'.substr($digits, 3);
        } elseif (! str_starts_with($digits, '62')) {
            $digits = '62'.$digits;
        }

        return $digits;
    }
}
