<?php

namespace App\Imports;

use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Services\AttributeTemplateService;
use App\Support\SpecificationsParser;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

/**
 * Mode B: Update Produk (stock_price_update).
 *
 * Mengubah harga & stok per varian, plus deskripsi dan spesifikasi produk
 * dari template v2 (diterapkan dari baris pertama grup yang sukses; sel
 * kosong berarti tidak mengubah).
 * SKU parent/variant yang tidak dikenal -> baris GAGAL "SKU tidak ditemukan",
 * TIDAK PERNAH membuat produk/varian baru.
 * stock_mode file/manual mengikuti aturan yang sama seperti import katalog.
 */
class ImportStockPriceUpdate implements OnEachRow, WithHeadingRow, WithChunkReading
{
    protected bool $started = false;

    /** Produk yang detailnya sudah diterapkan di job ini: [productId] => true. */
    protected array $detailApplied = [];

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
        // Selaraskan header v2 (SKU Produk, Harga, Stok) ke kunci internal
        // supaya template baru langsung terbaca tanpa menggandakan importer.
        $data = \App\Support\UpdateImportColumnMap::normalize($row->toArray());
        // Baris catatan/contoh di sheet Data (mis. "CATATAN: hapus baris ini")
        // dilewati, konsisten dengan importer katalog. Kalau admin lupa hapus
        // baris contoh, tidak muncul sebagai baris gagal.
        $firstCell = (string) ($data['parent_sku'] ?? array_values($data)[0] ?? '');
        if (preg_match('/^\s*(CATATAN|CONTOH)\s*:/i', $firstCell)) {
            return;
        }
        $job->increment('processed_rows');

        try {
            $parentSku = trim((string) ($data['parent_sku'] ?? ''));
            $variantSku = trim((string) ($data['variant_sku'] ?? ''));

            if ($parentSku === '' && $variantSku === '') {
                // Baris tanpa SKU = sheet non-data (Panduan) atau baris kosong:
                // dilewati senyap, konsisten dgn importer katalog. Kesalahan
                // SKU di sheet data tetap ditandai verifier sebelum eksekusi.
                return;
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

            // Kontrak update (owner 09-06): variant_sku harus benar-benar
            // milik parent_sku. Salah induk = error per baris, bukan diam-diam
            // mengupdate varian parent lain.
            if ($variant && $parentSku !== '' && $variant->product?->parent_sku !== $parentSku) {
                throw new \RuntimeException('variant_sku tidak cocok dengan parent_sku: '.$variantSku);
            }

            if (! $variant && $product) {
                // Tanpa variant_sku: target varian default bila ada, kalau tidak
                // produk single (harga/stok di level produk).
                $variant = $product->variants()
                    ->orderByRaw('is_default DESC, id ASC')
                    ->first();
            }

            $stockRaw = $data['stock'] ?? null;
            // KONTRAK STOK BARU (owner 2026-09-05): nilai di XLSX MENANG.
            // Mode 'manual' hanya fallback utk baris dengan kolom stock kosong.
            // (Lama: manual selalu menimpa seluruh stok, bertentangan dgn
            // semangat 'update'.)
            $resolvedStock = \App\Services\StockCellParser::resolve($stockRaw);
            $stock = $resolvedStock !== null
                ? $resolvedStock
                : ($job->stock_mode === 'manual' ? (int) $job->manual_stock : null);

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

            // Detail produk (template v2): deskripsi dan spesifikasi berlaku
            // untuk satu produk. Diterapkan dari baris pertama grup yang
            // sukses; sel kosong berarti tidak mengubah (kontrak update).
            if (! isset($this->detailApplied[$product->id])) {
                $this->detailApplied[$product->id] = true;
                $this->syncDetail($product, $data);
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

        $price = \App\Support\NumberCellNormalizer::parse($raw);
        if ($price === null) {
            throw new \RuntimeException('Harga tidak valid: '.(string) $raw);
        }
        if ($price <= 0) {
            throw new \RuntimeException('Harga 0 atau kurang tidak diizinkan. Nonaktifkan produk lewat form produk bila tidak jual.');
        }

        return $price;
    }

    /**
     * Terapkan deskripsi dan spesifikasi dari baris update ke produk.
     *
     * Atribut level varian tidak tersentuh. Spesifikasi menggantikan seluruh
     * atribut level produk dengan hasil parsing terbaru; bila tidak ada
     * pasangan "Nama: Nilai" yang sah, pakai template per sub model
     * (ADR-019) seperti importer katalog.
     */
    protected function syncDetail(Product $product, array $data): void
    {
        $description = trim((string) ($data['description'] ?? ''));
        $specsRaw = trim((string) ($data['specifications'] ?? ''));

        if ($description !== '') {
            $product->description = $description;
            $product->save();
        }

        if ($specsRaw === '') {
            return;
        }

        $product->attributes()->whereNull('product_variant_id')->delete();
        $created = 0;
        foreach (SpecificationsParser::parse($specsRaw) as $attr) {
            ProductAttribute::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'product_variant_id' => null,
                    'attribute_name' => $attr['name'],
                ],
                [
                    'attribute_value' => $attr['value'],
                    'source' => 'internal',
                ],
            );
            $created++;
        }

        if ($created === 0) {
            app(AttributeTemplateService::class)->applyToProduct($product);
        }
    }
}