<?php

namespace App\Imports;

use App\Jobs\DownloadProductMedia;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Services\ImportedProductActivationService;
use App\Support\ShopeeCatalogTaxonomy;
use App\Support\ShopeeStyleSku;
use App\Support\ShopeeVariationAxes;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Row;

/**
 * Adapter for the real Shopee "export" spreadsheets (et_title_* headers).
 *
 * These exports do NOT contain populated parent_sku / variant_sku columns.
 * They use product_id (parent) and variation_id (variant) instead, and the
 * real data starts at row 6 (rows 0-5 are title/label/hint rows). SKUs are
 * derived: parent_sku = "SP" + product_id, variant_sku = "SP" + product_id +
 * "-" + variation_id. Taxonomy and dimensions are parsed from the product name.
 */
class ShopeeCatalogExport implements OnEachRow, WithChunkReading
{
    protected bool $started = false;

    public function __construct(public int $jobId)
    {
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

        // Real data starts at sheet row 6 (1-indexed). Sheet rows < 6 are
        // title/label/hint rows. product_id is column 0.
        if ($rowIndex < 6) {
            return;
        }

        $productId = isset($data[0]) ? (string) $data[0] : '';
        if (! ctype_digit($productId)) {
            return; // skip non-data / footer rows
        }

        try {
            $parentSku = ShopeeStyleSku::formatParentSku($productId);
            $variationId = isset($data[2]) ? (string) $data[2] : '';
            $variationName = isset($data[3]) ? (string) $data[3] : '';
            $variantSkuRaw = isset($data[5]) ? (string) $data[5] : '';
            $price = isset($data[6]) ? (float) $data[6] : 0;
            $fileStock = isset($data[8]) ? (int) $data[8] : 0;
            $stock = $job->stock_mode === 'manual'
                ? (int) $job->manual_stock
                : $fileStock;

            // Nama produk WAJIB mengikuti kolom nama dari xlsx Shopee (kolom 1)
            // persis apa adanya. Pada baris varian nama bisa kosong — jangan
            // menimpa nama produk yang sudah ada dengan fallback.
            $existing = Product::where('parent_sku', $parentSku)->first();
            $rawName = trim((string) ($data[1] ?? ''));
            $name = ($rawName !== '' && $rawName !== 'Kode Produk')
                ? $rawName
                : ($existing?->name);

            if (! $name) {
                throw new \RuntimeException('nama produk kosong');
            }

            $taxonomy = ShopeeCatalogTaxonomy::fromProductName($name);
            $dimensions = $this->parseDimensions($name);

            $product = Product::updateOrCreate(
                ['parent_sku' => $parentSku],
                array_merge([
                    'name' => $name,
                    'short_name' => $existing?->short_name ?: $this->shortName($name),
                    'description' => $existing?->description ?: $name,
                    'category_id' => 0,
                    'product_category' => $taxonomy['category'],
                    'product_model' => $taxonomy['model'],
                    'design_variant' => $taxonomy['design'],
                    'status' => 'archived',
                ], $dimensions)
            );

            $variantSku = ShopeeStyleSku::formatVariantSku(
                $parentSku,
                $variationId !== '' ? $variationId : null,
                $variantSkuRaw !== '' ? $variantSkuRaw : null,
            );

            $axes = ShopeeVariationAxes::fromVariationName($variationName);

            $variant = ProductVariant::updateOrCreate(
                ['variant_sku' => $variantSku],
                array_merge([
                    'product_id' => $product->id,
                    'variation_1_name' => $axes['variation_1_name'],
                    'variation_1_option' => $axes['variation_1_option'],
                    'variation_2_name' => $axes['variation_2_name'],
                    'variation_2_option' => $axes['variation_2_option'],
                    'price' => $price,
                    'stock_mode' => $job->stock_mode,
                    'file_stock' => $fileStock,
                    'stock' => $stock,
                    'status' => 'active',
                ], $this->parseVariantDimensions($variationName))
            );
            $activation = app(\App\Services\ImportedProductActivationService::class)->apply($product);

            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => [
                    'product_id' => $productId,
                    'parent_sku' => $parentSku,
                    'name' => $name,
                    'variation_id' => $variationId,
                    'variant_sku' => $variantSku,
                    'price' => $price,
                    'stock' => $stock,
                    '_activation_status' => $activation['status'],
                    '_activation_reasons' => $activation['reasons'],
                    '_shipping_contract' => 'weight_kg,height_cm,width_cm,depth_cm must be > 0',
                ],
                'status' => 'success',
                'linked_product_id' => $product->id,
                'linked_product_variant_id' => $variant->id,
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

    public function chunkSize(): int
    {
        return 1000;
    }

    /**
     * @deprecated gunakan ShopeeCatalogTaxonomy::fromProductName
     * @return array{category: string, model: string, design: string}
     */
    protected function parseTaxonomy(string $name): array
    {
        return ShopeeCatalogTaxonomy::fromProductName($name);
    }

    protected function parseDimensions(string $name): array
    {
        $out = [];
        if (preg_match('/TINGGI\s+(\d+(?:[.,]\d+)?)\s*CM/iu', $name, $m)) {
            $out['height_cm'] = (float) str_replace(',', '.', $m[1]);
        }
        if (preg_match('/PANJANG\s+(\d+(?:[.,]\d+)?)\s*CM/iu', $name, $m)) {
            $out['width_cm'] = (float) str_replace(',', '.', $m[1]);
        }
        if (($out['height_cm'] ?? null) === null || ($out['width_cm'] ?? null) === null) {
            if (preg_match('/\((\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\)/iu', $name, $m)) {
                $out['height_cm'] = $out['height_cm'] ?? (float) str_replace(',', '.', $m[1]);
                $out['width_cm'] = $out['width_cm'] ?? (float) str_replace(',', '.', $m[2]);
            }
        }

        return $out;
    }

    protected function parseVariantDimensions(string $variationName): array
    {
        $out = [];
        if (preg_match('/T(\d+)\s*X\s*P(\d+)/i', $variationName, $m)) {
            $out['height_cm'] = (float) $m[1];
            $out['width_cm'] = (float) $m[2];
        }
        return $out;
    }

    protected function shortName(string $name): string
    {
        // e.g. "... Ornamen Tinggi 200 cm x Panjang 160 cm (200x160)"
        if (preg_match('/\((\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?)\)/iu', $name, $m)) {
            return str_replace([' ', '×', ','], ['', 'x', '.'], $m[1]);
        }

        return mb_substr($name, 0, 60);
    }
}
