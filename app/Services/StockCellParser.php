<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * Parser sel stok pada import (katalog & update harga/stok).
 *
 * Menerima tiga bentuk:
 *  - angka bulat >= 0        -> stok sebesar angka itu
 *  - "random MIN-MAKS"       -> stok acak inklusif di rentang [MIN, MAKS]
 *  - kosong/null             -> null (artinya ditentukan pemanggil:
 *                               pembuatan = 0, update = biarkan nilai lama)
 *
 * Format salah (mis. "random 8000", "random 9000-8000") -> InvalidArgumentException,
 * sehingga baris import ditandai gagal dengan pesan yang bisa dipahami.
 */
final class StockCellParser
{
    private const RANDOM_RE = '/^random\s+(\d{1,6})\s*[-–—,\.]\s*(\d{1,6})$/i';

    public static function resolve(?string $raw): ?int
    {
        if ($raw === null) {
            return null;
        }

        $cell = trim((string) $raw);
        if ($cell === '') {
            return null;
        }

        if (preg_match('/^\d+$/', $cell)) {
            return (int) $cell;
        }

        if (preg_match(self::RANDOM_RE, $cell, $m)) {
            $min = (int) $m[1];
            $max = (int) $m[2];
            if ($min > $max) {
                throw new InvalidArgumentException(
                    'Rentang stok acak salah: MIN ('.$min.') lebih besar dari MAKS ('.$max.'). Format yang benar: "random MIN-MAKS".'
                );
            }

            return random_int($min, $max);
        }

        throw new InvalidArgumentException(
            'Nilai stok tidak dikenali: "'.$cell.'". Gunakan angka bulat atau "random MIN-MAKS".'
        );
    }
}