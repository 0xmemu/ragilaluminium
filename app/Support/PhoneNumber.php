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

    /**
     * Format tampilan publik, contoh: +62 817-7637-0707.
     */
    public static function formatDisplay(?string $raw): ?string
    {
        $normalized = self::normalize($raw);
        if (! $normalized || ! str_starts_with($normalized, '62') || strlen($normalized) < 10) {
            $trimmed = trim((string) $raw);

            return $trimmed !== '' ? $trimmed : null;
        }

        $local = substr($normalized, 2);
        $parts = [substr($local, 0, 3)];
        $rest = substr($local, 3);
        while ($rest !== '') {
            $parts[] = substr($rest, 0, 4);
            $rest = substr($rest, 4);
        }

        return '+62 '.implode('-', array_filter($parts));
    }
}
