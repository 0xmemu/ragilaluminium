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
                for ($n = 1; $n <= 9; $n++) {
                    $url = trim((string) ($r['image_'.$n] ?? ''));
                    if ($url === '') { continue; }
                    $rowChanges[] = 'image_'.$n.' akan di-set';
                    break;
                }
                for ($n = 1; $n <= 2; $n++) {
                    $url = trim((string) ($r['installation_image_'.$n] ?? ''));
                    if ($url === '') { continue; }
                    $rowChanges[] = 'installation_image_'.$n.' akan di-set';
                    break;
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
