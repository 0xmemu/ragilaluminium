<?php

namespace App\Support;

/**
 * Verifikator file import katalog (pre-pass, all-or-nothing).
 *
 * Menjalankan aturan V1-V6 terhadap baris sheet Data (heading row snake_case):
 *  V1  id_key tidak boleh muncul kembali setelah digantikan (grup kontigu).
 *  V2  Satu id_key = satu name (inkonsistensi nama = gagal).
 *  V3  variantion_combination unik dalam satu id_key (duplikat = gagal).
 *  V4  Daftar opsi (variation_N_option_M) identik di semua baris satu id_key.
 *  V5  price_variantion_combination wajib > 0 pada tiap baris kombinasi.
 *  V6  id_key adalah kunci grup (aturan dasar, implisit).
 *
 * Fallback: file tanpa kolom id_key -> kunci grup = name (V1 skip).
 *
 * @return list<string> daftar pesan error (kosong = lolos)
 */
final class CatalogImportVerifier
{
    /**
     * @param  list<array<string, mixed>>  $rows  baris hasil toArray (heading row sudah dipakai)
     * @return list<string>
     */
    public static function verify(array $rows): array
    {
        $errors = [];
        $hasIdKeyColumn = array_key_exists('id_key', $rows[0] ?? [])
            || array_key_exists('name', $rows[0] ?? []) === false
            || array_key_exists('id_key', $rows[0] ?? []);

        $hasIdKey = false;
        foreach ($rows as $r) {
            if (trim((string) ($r['id_key'] ?? '')) !== '') { $hasIdKey = true; break; }
        }

        // Kunci grup per baris: id_key (baru) atau name (fallback).
        $groupKeys = [];
        $lastKey = null;
        $firstRowOfGroup = [];
        foreach ($rows as $i => $r) {
            $name = trim((string) ($r['name'] ?? ''));
            $combo = self::combination($r);
            $isDataRow = $name !== '' || $combo !== ''
                || self::anyOption($r);

            if (! $isDataRow) {
                // Penanda "CONTOH:" juga bukan data.
                foreach ($r as $cell) {
                    if (stripos((string) $cell, 'CONTOH:') === 0) { $isDataRow = false; break; }
                }
                if (! $isDataRow) { $groupKeys[$i] = null; continue; }
            }

            $idKey = trim((string) ($r['id_key'] ?? ''));
            if ($idKey !== '') {
                $key = 'id:'.$idKey;
            } else {
                $key = $name !== '' ? 'name:'.$name : ($lastKey !== null ? $lastKey : null);
            }
            if ($key === null) {
                $groupKeys[$i] = null;
                $errors[] = 'Baris '.($i + 2).': tidak punya id_key dan tidak ada baris grup sebelumnya.';
                continue;
            }
            $groupKeys[$i] = $key;
            $lastKey = $key;
        }

        // V1: grup kontigu (id_key tidak boleh dibuka lagi)
        if ($hasIdKey) {
            $seenClosed = [];
            $prevKey = null;
            foreach ($groupKeys as $i => $key) {
                if ($key === null) { continue; }
                if ($prevKey !== null && $key !== $prevKey) {
                    $seenClosed[$prevKey] = true;
                }
                if ($key !== $prevKey && isset($seenClosed[$key])) {
                    $idLabel = str_starts_with($key, 'id:') ? substr($key, 3) : $key;
                    $errors[] = 'Baris '.($i + 2).': id_key "'.$idLabel.'" muncul kembali setelah digantikan. Susun baris berurutan per produk.';
                }
                $prevKey = $key;
            }
        }

        // V2, V4, V3, V5 per grup
        $groups = [];
        foreach ($groupKeys as $i => $key) {
            if ($key === null) continue;
            $groups[$key][] = $i;
        }
        foreach ($groups as $key => $rowIdxs) {
            $names = [];
            $combos = [];
            $optionSig = null;
            $optionSigRow = null;
            $idLabel = str_starts_with($key, 'id:') ? substr($key, 3) : $key;
            foreach ($rowIdxs as $i) {
                $r = $rows[$i];
                $name = trim((string) ($r['name'] ?? ''));
                if ($name !== '') {
                    $names[strtolower($name)][] = $i + 2;
                }
                $combo = self::combination($r);
                if ($combo !== '') {
                    $price = self::price($r);
                    if ($price === null || $price <= 0) {
                        $errors[] = 'Baris '.($i + 2).': harga kosong atau nol untuk kombinasi "'.$combo.'" pada id_key "'.$idLabel.'".';
                    }
                    $comboKey = strtolower($combo);
                    if (isset($combos[$comboKey])) {
                        $errors[] = 'Baris '.($i + 2).': kombinasi "'.$combo.'" duplikat dengan baris '.$combos[$comboKey].' pada id_key "'.$idLabel.'".';
                    } else {
                        $combos[$comboKey] = $i + 2;
                    }
                }
                // V4: signature daftar opsi harus konsisten dalam grup.
                $sig = self::optionSignature($r);
                if ($sig !== null) {
                    if ($optionSig === null) {
                        $optionSig = $sig;
                        $optionSigRow = $i + 2;
                    } elseif ($sig !== $optionSig) {
                        $errors[] = 'Baris '.($i + 2).': daftar opsi varian berbeda dengan baris '.$optionSigRow.' pada id_key "'.$idLabel.'". Definisi opsi harus sama di semua baris grup.';
                    }
                }
            }
            // V2: satu id_key satu nama
            if (count($names) > 1) {
                $parts = [];
                foreach ($names as $n => $rowList) {
                    $parts[] = '"'.$n.'" (baris '.implode(', ', $rowList).')';
                }
                $errors[] = 'id_key "'.$idLabel.'" memuat nama berbeda: '.implode(' dan ', $parts).'. Samakan nama dalam satu id_key.';
            }
        }

        return $errors;
    }

    /** @param array<string, mixed> $r */
    private static function combination(array $r): string
    {
        foreach (['variantion_combination', 'variation_combination'] as $k) {
            if (array_key_exists($k, $r)) {
                $v = trim((string) $r[$k]);
                if ($v !== '') return $v;
            }
        }
        return '';
    }

    /** @param array<string, mixed> $r */
    private static function price(array $r): ?float
    {
        foreach (['price_variantion_combination', 'price'] as $k) {
            if (isset($r[$k]) && trim((string) $r[$k]) !== '') {
                return (float) str_replace(',', '.', (string) $r[$k]);
            }
        }
        return null;
    }

    /** @param array<string, mixed> $r */
    private static function anyOption(array $r): bool
    {
        for ($i = 1; $i <= 20; $i++) {
            if (trim((string) ($r['option_'.$i] ?? '')) !== '') return true;
        }
        for ($n = 1; $n <= 5; $n++) {
            for ($m = 1; $m <= 30; $m++) {
                foreach (['variation_'.$n.'_option_'.$m, 'variantion_'.$n.'_option_'.$m] as $k) {
                    if (trim((string) ($r[$k] ?? '')) !== '') return true;
                }
            }
            if (trim((string) ($r['variation_'.$n.'_option'] ?? '')) !== '') return true;
        }
        return false;
    }

    /**
     * Signature daftar opsi (baris yang mengisi definisi opsi).
     *
     * @param  array<string, mixed>  $r
     */
    private static function optionSignature(array $r): ?string
    {
        $sig = [];
        for ($n = 1; $n <= 5; $n++) {
            $name = trim((string) ($r['variation_'.$n.'_name'] ?? $r['variantion_'.$n.'_name'] ?? ''));
            $opts = [];
            for ($m = 1; $m <= 30; $m++) {
                $opt = trim((string) ($r['variation_'.$n.'_option_'.$m] ?? $r['variantion_'.$n.'_option_'.$m] ?? ''));
                if ($opt === '') break;
                $opts[] = $opt;
            }
            if ($name === '' && $opts === []) continue;
            $sig[] = $name.'='.implode('/', $opts);
        }
        if ($sig === []) return null;
        return implode(';', $sig);
    }
}
