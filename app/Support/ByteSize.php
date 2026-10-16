<?php

namespace App\Support;

/**
 * Ukuran berkas dalam satuan yang mudah dibaca manusia.
 *
 * Pesan galat unggah media sebelumnya menampilkan angka byte mentah
 * ("Ukuran file 52428800B melebihi batas 10485760B"), sehingga admin harus
 * menghitung sendiri berapa MB. Satuan dan pembulatannya disamakan dengan
 * formatBytes di resources/js/lib/format.ts supaya pesan server dan pesan
 * klien tidak berbeda gaya.
 */
final class ByteSize
{
    public static function human(int|float|null $bytes): string
    {
        if ($bytes === null || $bytes <= 0 || ! is_finite((float) $bytes)) {
            return '-';
        }

        if ($bytes < 1024) {
            return (int) $bytes.' B';
        }

        if ($bytes < 1024 * 1024) {
            return round($bytes / 1024).' KB';
        }

        return number_format($bytes / (1024 * 1024), 1, ',', '.').' MB';
    }
}
