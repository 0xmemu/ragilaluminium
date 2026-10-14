<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductVariant;

/**
 * Preview/diff untuk mode update (owner 09-06): bandingkan nilai file dengan
 * nilai DB saat ini dan laporkan baris mana yang benar-benar berubah.
 * Tidak menulis apa pun. Dipakai endpoint previewUpdate.
 */
final class UpdatePreviewDiff
{
    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  'stock_price_update'|'media_update'  $type
     * @return array{changes: list<string>, changed_rows: int, unchanged_rows: int}
     */
    public static function compute(array $rows, string $type, ?int $manualStock = null): array
    {
        $changes = [];
        $changedRows = 0;
        $unchangedRows = 0;

        $variantsBySku = [];
        $skus = [];
        foreach ($rows as $r) {
            $sku = trim((string) ($r['variant_sku'] ?? ''));
            if ($sku !== '') { $skus[$sku] = true; }
        }
        if ($skus !== []) {
            $variantsBySku = ProductVariant::whereIn('variant_sku', array_keys($skus))
                ->get()->keyBy(fn ($v) => mb_strtolower($v->variant_sku));
        }

        foreach ($rows as $i => $r) {
            $rowNo = $i + 2;
            $parent = trim((string) ($r['parent_sku'] ?? ''));
            $sku = trim((string) ($r['variant_sku'] ?? ''));
            if ($parent === '' && $sku === '') { continue; }

            $variant = $sku !== '' ? ($variantsBySku[mb_strtolower($sku)] ?? null) : null;
            if (! $variant) {
                $changedRows++;
                $changes[] = 'Baris '.$rowNo.': SKU '.$sku.' tidak dikenal (tidak ada perubahan).';
                continue;
            }

            $rowChanges = [];
            if ($type === 'stock_price_update') {
                $priceRaw = $r['price'] ?? null;
                if ($priceRaw !== null && trim((string) $priceRaw) !== '') {
                    $newPrice = (float) str_replace(',', '.', (string) $priceRaw);
                    if (abs($newPrice - (float) $variant->price) > 0.001) {
                        $rowChanges[] = 'harga '.number_format((float) $variant->price, 0).' -> '.number_format($newPrice, 0);
                    }
                }
                $stockResolved = \App\Services\StockCellParser::resolve($r['stock'] ?? null);
                if ($stockResolved === null && ($r['stock'] ?? null) === null && $manualStock !== null) {
                    $stockResolved = $manualStock;
                }
                if ($stockResolved !== null && (int) $stockResolved !== (int) $variant->stock) {
                    $rowChanges[] = 'stok '.((int) $variant->stock).' -> '.((int) $stockResolved);
                }
            } elseif ($type === 'media_update') {
                // Bandingkan dgn media existing per posisi: URL identik =
                // tidak dihitung berubah (media diulang di semua baris grup,
                // tanpa edit file round-trip harus tetap 0 perubahan).
                $productMedia = $variant->product?->media
                    ? $variant->product->media->sortBy('position')
                    : collect();
                // Kelompokkan media lama per posisi mengikuti pemetaan importer:
                // Gambar 1..9 = posisi 1..9, Media Bersama N = posisi 80+N,
                // hasil pemasangan N = posisi 100+N, gambar per varian = baris
                // milik varian tersebut. Perbandingan memakai keanggotaan
                // daftar, bukan satu URL terakhir, supaya baris kembar pada
                // posisi sama tidak memicu perubahan palsu (temuan 14 Okt 2026).
                $byMain = [];
                $byInst = [];
                $byShared = [];
                $byVariant = [];
                foreach ($productMedia as $m) {
                    $u = (string) ($m->urlFor('pdp') ?? $m->mediaAsset?->urlFor('pdp') ?? '');
                    if ($u === '') { continue; }
                    $pos = (int) $m->position;
                    if ($m->product_variant_id !== null || ($pos >= 50 && $pos <= 79)) {
                        $byVariant[(int) $m->product_variant_id][] = $u;
                        continue;
                    }
                    if ((bool) $m->is_installation || $pos >= 101) {
                        $byInst[$pos - 100][] = $u;
                        continue;
                    }
                    if ($pos >= 81 && $pos <= 90) {
                        $byShared[$pos - 80][] = $u;
                        continue;
                    }
                    $byMain[$pos][] = $u;
                }
                $real = 0;
                for ($n = 1; $n <= 9; $n++) {
                    $url = trim((string) ($r['image_'.$n] ?? ''));
                    if ($url === '') { continue; }
                    if (! in_array($url, $byMain[$n] ?? [], true)) {
                        $rowChanges[] = 'Gambar '.$n.' diubah';
                        $real++;
                    }
                }
                for ($n = 1; $n <= 9; $n++) {
                    $url = trim((string) ($r['installation_image_'.$n] ?? ''));
                    if ($url === '') { continue; }
                    if (! in_array($url, $byInst[$n] ?? [], true)) {
                        $rowChanges[] = 'Gambar Hasil Pemasangan '.$n.' diubah';
                        $real++;
                    }
                }
                for ($n = 1; $n <= 4; $n++) {
                    $url = trim((string) ($r['shared_media_'.$n] ?? ''));
                    if ($url === '') { continue; }
                    if (! in_array($url, $byShared[$n] ?? [], true)) {
                        $rowChanges[] = 'Media Bersama '.$n.' diubah';
                        $real++;
                    }
                }
                // Template v2 memakai satu kolom Gambar per Varian per baris.
                $optUrl = trim((string) ($r['image_variation_option'] ?? ''));
                if ($optUrl !== '' && ! in_array($optUrl, $byVariant[(int) $variant->id] ?? [], true)) {
                    $rowChanges[] = 'Gambar per Varian diubah';
                    $real++;
                }
                foreach ($r as $col => $val) {
                    if (is_string($col) && preg_match('/^image_variation_(\d+)_option_(\d+)$/', $col, $mm)) {
                        $url = trim((string) $val);
                        if ($url === '') { continue; }
                        if (! in_array($url, $byVariant[(int) $variant->id] ?? [], true)) {
                            $rowChanges[] = $col.' diubah';
                            $real++;
                        }
                    }
                }
                if ($real === 0 && $rowChanges === []) {
                    // Semua URL identik dgn existing: benar-benar tidak berubah.
                }
            }

            if ($rowChanges !== []) {
                $changedRows++;
                $changes[] = 'Baris '.$rowNo.' ('.$sku.'): '.implode('; ', $rowChanges).'.';
            } else {
                $unchangedRows++;
            }
        }

        return ['changes' => $changes, 'changed_rows' => $changedRows, 'unchanged_rows' => $unchangedRows];
    }
}
