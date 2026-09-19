<?php

namespace App\Support;

/**
 * Verifikator file Update Harga & Stok (stock_price_update) dan Update Media
 * (media_update): pre-pass all-or-nothing, satu standar dengan import katalog.
 *
 * Aturan umum:
 *  U1/M1  parent_sku wajib di baris data.
 *  U2/M2  SKU tidak dikenal = error (dicek ke DB).
 *  U3/M3  target duplikat (parent_sku + variant_sku) = error.
 *  U4     price & stock kosong bersamaan = error.
 *  U5     price >= 0; stock >= 0 atau rentang "a-b".
 *  M4     semua kolom gambar kosong + SKU dikenal = SKIP (baris dilewati).
 *  M5     URL gambar tidak valid = error.
 *  M7     installation_slots format salah = error.
 *
 * Kontrak stok (owner 2026-09-05): nilai di XLSX MENANG. Mode manual hanya
 * fallback untuk baris dengan kolom stock kosong.
 */
final class UpdateImportVerifier
{
    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  'stock_price_update'|'media_update'  $type
     * @return array{errors: list<string>, skipped: int}
     */
    public static function verify(array $rows, string $type, ?int $manualStock = null): array
    {
        $errors = [];
        $skipped = 0;

        $isStock = $type === 'stock_price_update';
        $isMedia = $type === 'media_update';

        // Kumpulkan baris data (punya parent_sku ATAU variant_sku) + resolusi SKU
        $targets = [];
        $skusToCheck = [];
        $mediaSkipRows = [];
        if ($isMedia) {
            // M4 pre-scan: baris media tanpa gambar sama sekali = SKIP (bukan
            // target duplikat, bukan error). Owner 09-05.
            foreach ($rows as $i => $r) {
                $parent = trim((string) ($r['parent_sku'] ?? ''));
                $variant = trim((string) ($r['variant_sku'] ?? ''));
                if ($parent === '' && $variant === '') { continue; }
                $hasImage = false;
                for ($n = 1; $n <= 9; $n++) {
                    if (trim((string) ($r['image_'.$n] ?? '')) !== ''
                        || trim((string) ($r['installation_image_'.$n] ?? '')) !== '') {
                        $hasImage = true; break;
                    }
                }
                if (! $hasImage) { $mediaSkipRows[] = $i; }
            }
            $skipped = count($mediaSkipRows);
        }
        $skipIdx = array_flip($mediaSkipRows ?? []);
        foreach ($rows as $i => $r) {
            $parent = trim((string) ($r['parent_sku'] ?? ''));
            $variant = trim((string) ($r['variant_sku'] ?? ''));
            if ($parent === '' && $variant === '') {
                continue; // bukan baris data (kosong/contoh)
            }
            if (isset($skipIdx[$i])) {
                continue; // baris dilewati: tidak dihitung duplikat/target
            }
            $rowNo = $i + 2;

            // U1/M1: parent wajib bila variant kosong; bila variant diisi,
            // parent boleh kosong (variant unik global), tapi disarankan.
            if ($parent === '' && $variant === '') {
                $errors[] = 'Baris '.$rowNo.': SKU kosong.';
                continue;
            }
            if ($parent === '' && $variant !== '') {
                // boleh: resolusi by variant only
            }

            $key = mb_strtolower($parent.'|'.$variant);
            $targets[$key][] = $rowNo;
            $skusToCheck[$rowNo] = ['parent' => $parent, 'variant' => $variant];
        }

        // U3/M3: duplikat target
        foreach ($targets as $key => $rowNos) {
            if (count($rowNos) > 1) {
                $errors[] = 'SKU '.($key !== '|' ? str_replace('|', ' / ', $key) : '(kosong)').' duplikat di baris '.implode(', ', $rowNos).'. Satu baris per SKU.';
            }
        }

        // U2/M2: resolusi SKU ke DB (batch query)
        $parents = [];
        $variants = [];
        foreach ($skusToCheck as $sku) {
            if ($sku['parent'] !== '') { $parents[$sku['parent']] = true; }
            if ($sku['variant'] !== '') { $variants[$sku['variant']] = true; }
        }
        $parentRows = $parents !== []
            ? \App\Models\Product::whereIn('parent_sku', array_keys($parents))->pluck('id', 'parent_sku')
            : collect();
        $variantRows = $variants !== []
            ? \App\Models\ProductVariant::whereIn('variant_sku', array_keys($variants))->get(['id', 'variant_sku', 'product_id'])
            : collect();
        $variantParentIds = [];
        $parentSkuById = [];
        if ($variantRows->isNotEmpty()) {
            $parentModels = \App\Models\Product::whereIn('id', $variantRows->pluck('product_id')->unique())->pluck('parent_sku', 'id');
            foreach ($variantRows as $v) {
                $variantParentIds[mb_strtolower((string) $v->variant_sku)] = $parentModels[$v->product_id] ?? null;
            }
        }

        foreach ($skusToCheck as $rowNo => $sku) {
            $parent = $sku['parent'];
            $variant = $sku['variant'];
            if ($variant !== '') {
                $resolvedParent = $variantParentIds[mb_strtolower($variant)] ?? null;
                if ($resolvedParent === null) {
                    $errors[] = 'Baris '.$rowNo.': variant_sku "'.$variant.'" tidak ditemukan.';
                    continue;
                }
                if ($parent !== '' && strcasecmp($resolvedParent, $parent) !== 0) {
                    $errors[] = 'Baris '.$rowNo.': variant_sku "'.$variant.'" bukan milik produk "'.$parent.'" (milik "'.$resolvedParent.'").';
                    continue;
                }
            } elseif ($parent !== '' && ! $parentRows->has($parent)) {
                $errors[] = 'Baris '.$rowNo.': parent_sku "'.$parent.'" tidak ditemukan.';
                continue;
            }

            if ($isMedia) {
                // M5: URL valid (M4 sudah di pre-scan)
                for ($n = 1; $n <= 9; $n++) {
                    foreach (['image_'.$n, 'installation_image_'.$n] as $col) {
                        $url = trim((string) ($rows[$rowNo - 2][$col] ?? ''));
                        if ($url !== '' && ! filter_var($url, FILTER_VALIDATE_URL)) {
                            $errors[] = 'Baris '.$rowNo.': URL pada kolom '.$col.' tidak valid.';
                        }
                    }
                }
                // M7: installation_slots
                $slots = trim((string) ($rows[$rowNo - 2]['installation_slots'] ?? ''));
                if ($slots !== '' && ! preg_match('/^(?:[1-9])(?:\s*,\s*[1-9])*$/', $slots)) {
                    $errors[] = 'Baris '.$rowNo.': installation_slots "'.$slots.'" tidak valid. Format: angka 1-9 dipisah koma, mis. "7,8,9".';
                }
            }

            if ($isStock) {
                $priceRaw = trim((string) ($rows[$rowNo - 2]['price'] ?? ''));
                $stockRaw = trim((string) ($rows[$rowNo - 2]['stock'] ?? ''));

                // U4: keduanya kosong
                if ($priceRaw === '' && $stockRaw === '') {
                    $errors[] = 'Baris '.$rowNo.': tidak ada yang diubah (harga dan stok kosong).';
                    continue;
                }
                // U5 price: normalisasi format ribuan/desimal Indonesia.
                if ($priceRaw !== '') {
                    $price = \App\Support\NumberCellNormalizer::parse($priceRaw);
                    if ($price === null) {
                        $errors[] = 'Baris '.$rowNo.': harga "'.$priceRaw.'" tidak valid.';
                    } elseif ($price <= 0) {
                        $errors[] = 'Baris '.$rowNo.': harga 0 atau kurang tidak diizinkan. Nonaktifkan produk lewat form produk bila tidak jual.';
                    }
                }
                // U5 stock: angka atau rentang a-b
                if ($stockRaw !== '') {
                    if (preg_match('/^random\s+(\d+)\s*-\s*(\d+)$/i', $stockRaw, $m)) {
                        if ((int) $m[1] > (int) $m[2]) {
                            $errors[] = 'Baris '.$rowNo.': rentang stok "'.$stockRaw.'" tidak valid (awal > akhir).';
                        }
                    } elseif (preg_match('/^(\d+)\s*-\s*(\d+)$/', $stockRaw, $m)) {
                        if ((int) $m[1] > (int) $m[2]) {
                            $errors[] = 'Baris '.$rowNo.': rentang stok "'.$stockRaw.'" tidak valid (awal > akhir).';
                        }
                    } elseif (! preg_match('/^\d+$/', $stockRaw)) {
                        $errors[] = 'Baris '.$rowNo.': stok "'.$stockRaw.'" tidak valid. Isi angka, rentang a-b, atau random a-b.';
                    }
                }
                // Kontrak stok: kolom stok WAJIB diisi. Mode stok manual sudah
                // dihapus dari UI, sehingga satu-satunya sumber stok adalah
                // kolom Stok di berkas.
                if ($stockRaw === '' && $priceRaw !== '') {
                    $errors[] = 'Baris '.$rowNo.': stok kosong. Isi kolom Stok di berkas.';
                }
            }
        }

        return ['errors' => $errors, 'skipped' => $skipped];
    }
}
