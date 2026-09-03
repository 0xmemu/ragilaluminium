<?php

namespace App\Imports;

use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductVariant;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

/**
 * Mode B: Update Harga & Stok (stock_price_update).
 *
 * Hanya mengubah price & stock (kolom lain DIABAIKAN walau ada di file).
 * SKU parent/variant yang tidak dikenal -> baris GAGAL "SKU tidak ditemukan",
 * TIDAK PERNAH membuat produk/varian baru.
 * stock_mode file/manual mengikuti aturan yang sama seperti import katalog.
 */
class ImportStockPriceUpdate implements OnEachRow, WithHeadingRow, WithChunkReading
{
    protected bool $started = false;

    public function __construct(public int $jobId)
    {
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function onRow(Row $row): void
    {
        $job = ImportJob::find($this->jobId);
        if (! $job) {
            return;
        }

        if (! $this->started) {
            $job->update(['status' => 'running', 'started_at' => now()]);
            $this->started = true;
        }

        $rowIndex = $row->getIndex();
        $data = $row->toArray();
        $job->increment('processed_rows');

        try {
            $parentSku = trim((string) ($data['parent_sku'] ?? ''));
            $variantSku = trim((string) ($data['variant_sku'] ?? ''));

            if ($parentSku === '' && $variantSku === '') {
                throw new \RuntimeException('parent_sku/variant_sku kosong');
            }

            $variant = $variantSku === ''
                ? null
                : ProductVariant::where('variant_sku', $variantSku)->first();

            $product = $variant?->product
                ?? ($parentSku === '' ? null : Product::where('parent_sku', $parentSku)->first());

            if (! $product) {
                $unknown = $variantSku !== '' ? $variantSku : $parentSku;
                throw new \RuntimeException('SKU tidak ditemukan: '.$unknown);
            }

            if (! $variant && $product) {
                // Tanpa variant_sku: target varian default bila ada, kalau tidak
                // produk single (harga/stok di level produk).
                $variant = $product->variants()
                    ->orderByRaw('is_default DESC, id ASC')
                    ->first();
            }

            $stockRaw = $data['stock'] ?? null;
            // Aturan: kolom kosong = nilai TIDAK diubah. Mode 'manual' selalu
            // menetapkan stok dari konfigurasi job (perilaku asli dipertahankan).
            $stock = $job->stock_mode === 'manual'
                ? (int) $job->manual_stock
                : (($stockRaw === '' || $stockRaw === null) ? null : max(0, (int) $stockRaw));

            if ($variant) {
                $updates = ['price' => $this->price($data, $variant->price)];
                if ($stock !== null) {
                    $updates['stock'] = $stock;
                }
                $variant->update($updates);
            } else {
                // Produk tanpa varian: harga/stok tidak bisa diperbarui karena
                // kolom price/stock hanya ada di product_variants. Gagalkan
                // baris agar admin tahu (bukan diam-diam tidak berubah).
                throw new \RuntimeException(
                    'Varian tidak ditemukan untuk '.$parentSku.'. Harga/stok hanya bisa diupdate per varian.'
                );
            }

            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => array_merge($data, [
                    '_stock_mode' => $job->stock_mode,
                    '_effective_stock' => $variant?->stock ?? $product->stock,
                ]),
                'status' => 'success',
                'linked_product_id' => $product->id,
                'linked_product_variant_id' => $variant?->id,
                'processed_at' => now(),
            ]);
            $job->increment('success_rows');
        } catch (\Throwable $e) {
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => $data,
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'processed_at' => now(),
            ]);
            $job->increment('failed_rows');
        }
    }

    protected function price(array $data, float $fallback): float
    {
        $raw = $data['price'] ?? null;
        if ($raw === '' || $raw === null) {
            return $fallback;
        }

        return (float) str_replace(',', '.', (string) $raw);
    }
}