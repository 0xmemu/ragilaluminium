<?php

namespace App\Support;

/**
 * Normalisasi sel angka dari berkas import (harga, berat, dimensi).
 *
 * Konvensi angka Indonesia (temuan audit P1-2, 19 Sep 2026): titik dan koma
 * sebagai PEMISAH RIBUAN bila polanya kelompok tiga angka ("1.250.000" menjadi
 * 1250000), dan sebagai DESIMAL hanya bila di belakangnya ada 1-2 angka
 * ("12.5" tetap 12.5, "1.250,50" menjadi 1250.5). Tanpa ini harga berformat
 * ribuan tersimpan sebagai nilai desimal rongsok (1.25).
 *
 * Sel yang tidak bisa diparse mengembalikan null; pemanggil memutuskan
 * fallback atau penolakan.
 */
final class NumberCellNormalizer
{
    public static function parse(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        $raw = trim(str_replace([chr(0xC2).chr(0xA0), 'Rp', 'rp'], ' ', (string) $value));
        if ($raw === '') {
            return null;
        }

        // Sisakan angka, titik, koma, dan minus; buang sisanya.
        $raw = (string) preg_replace('/[^0-9.,\-]/', '', $raw);
        if ($raw === '' || ! preg_match('/\d/', $raw)) {
            return null;
        }

        $hasDot = str_contains($raw, '.');
        $hasComma = str_contains($raw, ',');

        if ($hasDot && $hasComma) {
            // Pemisah terakhir adalah desimal; sisanya ribuan.
            $decSep = strrpos($raw, '.') > strrpos($raw, ',') ? '.' : ',';
            $thouSep = $decSep === '.' ? ',' : '.';
            $raw = str_replace($thouSep, '', $raw);
            $raw = str_replace($decSep, '.', $raw);
        } elseif ($hasDot || $hasComma) {
            $sep = $hasDot ? '.' : ',';
            $parts = explode($sep, $raw);
            $last = $parts[count($parts) - 1];
            if (count($parts) > 2 || (count($parts) === 2 && strlen($last) === 3)) {
                // Dua pemisah ke atas ("1.250.000") atau satu pemisah dengan
                // tepat tiga angka di belakang ("1.250") = pemisah ribuan.
                $raw = str_replace($sep, '', $raw);
            } else {
                // Satu pemisah dengan 1-2 angka di belakang ("12.5") = desimal.
                $raw = str_replace($sep, '.', $raw);
            }
        }

        return is_numeric($raw) ? (float) $raw : null;
    }
}
