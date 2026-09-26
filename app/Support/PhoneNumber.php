<?php

namespace App\Support;

/**
 * Normalisasi nomor telepon Indonesia ke format E.164 tanpa "+" (62xxxxxxxxxx),
 * dipakai konsisten untuk order lookup, WhatsApp, dan J&T.
 *
 * Juga menyediakan format lokal pelanggan dalam format 08xxx (bukan 62xxx).
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
     * Konversi nomor ke format lokal Indonesia berawalan 08xxx (bukan 62xxx).
     * Kontrak owner 2026-09-27: nomor yang ditampilkan ke pelanggan atau input
     * pelanggan berformat 08xxx, bukan 62xxx.
     */
    public static function toLocal(?string $raw): ?string
    {
        $normalized = self::normalize($raw);
        if (! $normalized) {
            return null;
        }

        if (str_starts_with($normalized, '62')) {
            return '0'.substr($normalized, 2);
        }

        return $normalized;
    }

    /**
     * Format tampilan publik untuk pelanggan: 08xx-xxxx-xxxx (bukan +62xxx atau 62xxx).
     * Kontrak owner 2026-09-27: semua nomor yang diperlihatkan ke pelanggan
     * wajib berformat 08xxx, bukan 62xxx.
     */
    public static function formatDisplay(?string $raw): ?string
    {
        $local = self::toLocal($raw);
        if (! $local || strlen($local) < 9) {
            $trimmed = trim((string) $raw);
            return $trimmed !== '' ? $trimmed : null;
        }

        // Format 08xx-xxxx-xxxx (prefix 4 digit, tengah 4 digit, sisa di belakang)
        if (str_starts_with($local, '08')) {
            $prefix = substr($local, 0, 4);
            $mid = substr($local, 4, 4);
            $rest = substr($local, 8);
            return $rest !== '' ? "{$prefix}-{$mid}-{$rest}" : "{$prefix}-{$mid}";
        }

        return $local;
    }
}
