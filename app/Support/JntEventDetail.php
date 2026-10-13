<?php

namespace App\Support;

/**
 * Parser deskripsi event J&T -> detail customer-friendly.
 *
 * Format asli (dari API J&T, contoh nyata di DB):
 *   "【Kab Banjarnegara】【BJN006A】Kuri J&T Cargo Anda Kefien Pradis 0819xxxxxxx"
 *   "【Kab Banjarnegara】Paket sudah meninggalkan【GW-BanjarnegaraMitra】menuju【GW-Tegal】"
 *   "【Kota Tasikmalaya】Paket sudah tiba di 【GW-Tasikmalaya】"
 *
 * Hanya field yang BISA dipastikan yang dikembalikan; sisanya null (jangan mengarang).
 * Tidak pernah mengembalikan deskripsi mentah.
 */
final class JntEventDetail
{
    /**
     * @return array{location:?string,origin:?string,destination:?string,courierName:?string,courierPhone:?string}|null
     */
    public static function parse(?string $raw): ?array
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        $result = [
            'location' => null,
            'origin' => null,
            'destination' => null,
            'courierName' => null,
            'courierPhone' => null,
        ];

        // Lokasi: kota dari kotak 【Kab/Kota ...】 (pertama yang berupa wilayah).
        if (preg_match_all('/【(Kota|Kab)\s+([^】]+)】/', $raw, $m)) {
            $result['location'] = $m[1][0].' '.$m[2][0];
        }

        // Rute: "...meninggalkan【GW-...】menuju【GW-...】" -> destination dari "menuju".
        if (preg_match('/menuju【[^】]+】/', $raw)) {
            if (preg_match('/meninggalkan【[^】]+】/', $raw)) {
                if (preg_match('/meninggalkan【[^】]+】\s*menuju【GW-([^】]+)】/', $raw, $md)) {
                    $result['destination'] = 'GW-'.$md[1];
                }
            } elseif (preg_match('/menuju【GW-([^】]+)】/', $raw, $md2)) {
                $result['destination'] = 'GW-'.$md2[1];
            }
        }

        // Kurir: "Kuri J&T Cargo Anda NAMA (08XXXXXXXXXX) sudah ..." atau
        // "... Anda NAMA 08XXXXXXXXXX ..." (nomor langsung setelah nama).
        if (preg_match('/Anda\s+([A-Za-z][A-Za-z\s\.]*?)(?:\s*\((\d{9,13})\))?\s*(?:sudah|$|\.)/i', $raw, $m3)) {
            $name = trim($m3[1]);
            $phone = $m3[2] ?? null;
            // Hanya nama yang masuk akal (maks 60 char, tanpa kata/tanda asing).
            if ($name !== '' && strlen($name) <= 60 && ! str_contains($name, ':')) {
                $result['courierName'] = $name;
            }
            if ($phone !== null && strlen($phone) >= 9 && strlen($phone) <= 13) {
                $result['courierPhone'] = $phone;
            }
        }

        if ($result === ['location' => null, 'origin' => null, 'destination' => null, 'courierName' => null, 'courierPhone' => null]) {
            return null;
        }

        return $result;
    }
}