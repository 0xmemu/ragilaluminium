<?php

namespace App\Support;

/**
 * Parsing kolom Spesifikasi template katalog: "Nama: Nilai" dipisah koma,
 * grup dipisah titik koma atau baris baru.
 *
 * Koma juga pemisah resmi, tetapi banyak nilai katalog mengandung koma (mis.
 * "Powder coating interpon (pilihan: hitam, putih)"), sehingga potongan koma
 * hanya dianggap pasangan baru bila memuat titik dua; kalau tidak, potongan
 * itu disambungkan kembali ke nilai sebelumnya.
 *
 * Dipusatkan di sini supaya importer katalog dan importer update memakai
 * aturan yang sama persis dan tidak bisa berbeda satu sama lain.
 */
final class SpecificationsParser
{
    /** @return list<array{name: string, value: string}> */
    public static function parse(string $raw): array
    {
        $attributes = [];
        $push = static function (string $part) use (&$attributes): void {
            foreach (preg_split("/,/", $part) ?: [] as $chunk) {
                if (trim($chunk) === "") {
                    continue;
                }

                if (str_contains($chunk, ":")) {
                    [$nama, $nilai] = array_pad(explode(":", $chunk, 2), 2, null);
                    if (trim((string) $nama) !== "" && trim((string) $nilai) !== "") {
                        $attributes[] = ["name" => trim($nama), "value" => trim($nilai)];
                    }

                    continue;
                }

                $last = count($attributes) - 1;
                if ($last < 0) {
                    continue;
                }
                $attributes[$last]["value"] = rtrim((string) $attributes[$last]["value"]).", ".trim($chunk);
            }
        };

        foreach (preg_split("/[;\n]+/", $raw) ?: [] as $part) {
            $push((string) $part);
        }

        return $attributes;
    }
}
