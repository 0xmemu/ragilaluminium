<?php

namespace App\Imports;

use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Services\ImportedProductActivationService;
use App\Support\InstallationGallery;
use App\Support\ProductMediaStubUpserter;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

class CatalogProductsImport implements OnEachRow, WithHeadingRow, WithChunkReading
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

        try {
            $parentSku = trim((string) ($data['parent_sku'] ?? ''));
            $name = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
            // Auto-mode: kolom parent_sku tidak diisi (template create). Sistem
            // mengelompokkan varian berdasarkan NAMA produk (grouping by name),
            // dan membuat parent_sku baru (RGL-{acak}) untuk produk baru.
            $autoMode = $parentSku === '';
            if ($autoMode) {
                $existingByName = $name !== ''
                    ? Product::where('name', $name)->first()
                    : null;
                if ($existingByName) {
                    $parentSku = (string) $existingByName->parent_sku;
                } else {
                    $parentSku = $this->generateParentSku();
                }
            }
            if ($parentSku === '') {
                throw new \RuntimeException('parent_sku dan name kosong');
            }

            // Resolusi kategori dari sumber DINAMIS (tabel categories), bukan default
            // WINDOW. Kategori tak dikenal / tidak diisi ditandai untuk review admin.
            $existingProduct = Product::where('parent_sku', $parentSku)->first();
            $rawCategory = trim(strtoupper((string) ($data['product_category'] ?? '')));
            $productCategory = $rawCategory === ''
                ? (string) ($existingProduct?->product_category ?? '')
                : (\App\Support\CatalogLabels::normalizeCategory($rawCategory) ?? '');

            if ($productCategory === '') {
                throw new \RuntimeException(
                    $rawCategory === ''
                        ? 'master kategori tidak diisi (perlu ditinjau admin)'
                        : 'kategori tidak dikenal: '.$rawCategory.' (perlu ditinjau admin)'
                );
            }

            $product = Product::updateOrCreate(
                ['parent_sku' => $parentSku],
                [
                    'name' => $data['name'] ?? $data['product_name'] ?? $parentSku,
                    'short_name' => $this->deriveShortName($data),
                    'search_keywords' => $this->deriveKeywords($data, $productCategory),
                    'description' => $data['description'] ?? null,
                    'product_category' => $productCategory,
                    'product_model' => \App\Support\CatalogLabels::normalizeModel($data['product_model'] ?? 'SLIDING') ?? 'SLIDING',
                    'design_variant' => \App\Support\CatalogLabels::normalizeDesign($data['design_variant'] ?? 'POLOS') ?? 'POLOS',
                    'status' => 'archived',
                ]
            );

            $variantSku = trim((string) ($data['variant_sku'] ?? ''));
            if ($autoMode && $variantSku === '') {
                $hasVariation = false;
                for ($i = 1; $i <= 5; $i++) {
                    if (trim((string) ($data['variation_'.$i.'_option'] ?? '')) !== '') {
                        $hasVariation = true;
                        break;
                    }
                }
                if ($hasVariation) {
                    $n = ProductVariant::where('product_id', $product->id)->count() + 1;
                    $variantSku = $parentSku.'-'.$n;
                }
            }
            $variant = null;
            if ($variantSku !== '') {
                $stock = $job->stock_mode === 'manual'
                    ? (int) $job->manual_stock
                    : (\App\Services\StockCellParser::resolve($data['stock'] ?? null) ?? 0);
                $variant = ProductVariant::updateOrCreate(
                    ['variant_sku' => $variantSku],
                    [
                        'product_id' => $product->id,
                        'variation_1_name' => $data['variation_1_name'] ?? null,
                        'variation_1_option' => $data['variation_1_option'] ?? null,
                        'variation_2_name' => $data['variation_2_name'] ?? null,
                        'variation_2_option' => $data['variation_2_option'] ?? null,
                        'variation_3_name' => $data['variation_3_name'] ?? null,
                        'variation_3_option' => $data['variation_3_option'] ?? null,
                        'variation_4_name' => $data['variation_4_name'] ?? null,
                        'variation_4_option' => $data['variation_4_option'] ?? null,
                        'variation_5_name' => $data['variation_5_name'] ?? null,
                        'variation_5_option' => $data['variation_5_option'] ?? null,
                        'price' => (float) ($data['price'] ?? 0),
                        'stock' => $stock,
                        'weight_kg' => $this->number($data, ['weight_kg', 'weight', 'packing_weight']),
                        'height_cm' => $this->number($data, ['height_cm', 'height', 'packing_height']),
                        'width_cm' => $this->number($data, ['width_cm', 'width', 'packing_width']),
                        'depth_cm' => $this->number($data, ['depth_cm', 'depth', 'length', 'packing_depth', 'packing_length']),
                        'status' => 'active',
                    ]
                );
            }

            $this->syncAttributes($product, $variant, $data);

            $installationSlots = InstallationGallery::parseSlots(
                isset($data['installation_slots']) ? (string) $data['installation_slots'] : null
            );

            for ($i = 1; $i <= 9; $i++) {
                $url = $data['image_'.$i] ?? $data['image_url_'.$i] ?? null;
                if ($url && filter_var($url, FILTER_VALIDATE_URL)) {
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: $variant?->id,
                        url: (string) $url,
                        position: $i,
                        isMain: $i === 1,
                        showInCatalog: true,
                        isInstallation: in_array($i, $installationSlots, true),
                    );
                }
            }

            for ($i = 1; $i <= 9; $i++) {
                $url = $data['installation_image_'.$i] ?? null;
                if ($url && filter_var($url, FILTER_VALIDATE_URL)) {
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: $variant?->id,
                        url: (string) $url,
                        position: 100 + $i,
                        isMain: false,
                        showInCatalog: false,
                        isInstallation: true,
                    );
                }
            }

            $activation = app(ImportedProductActivationService::class)->apply($product);
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => array_merge($data, [
                    '_stock_mode' => $job->stock_mode,
                    '_effective_stock' => $variant?->stock,
                    '_activation_status' => $activation['status'],
                    '_activation_reasons' => $activation['reasons'],
                    '_shipping_contract' => 'weight_kg,height_cm,width_cm,depth_cm must be > 0',
                    '_media_queue' => true,
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

    protected function number(array $data, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== '' && $data[$key] !== null) {
                return (float) str_replace(',', '.', (string) $data[$key]);
            }
        }

        return null;
    }

    protected function syncAttributes(Product $product, ?ProductVariant $variant, array $data): void
    {
        $attributes = [];
        $raw = $data['specifications'] ?? $data['attributes'] ?? null;

        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $attributes = $decoded;
            } else {
                foreach (preg_split('/[;\\n]+/', $raw) ?: [] as $part) {
                    [$name, $value] = array_pad(explode(':', $part, 2), 2, null);
                    if (trim((string) $name) !== '' && trim((string) $value) !== '') {
                        $attributes[] = ['name' => trim($name), 'value' => trim($value)];
                    }
                }
            }
        } elseif (is_array($raw)) {
            $attributes = $raw;
        }

        if (($data['attribute_name'] ?? '') !== '' && ($data['attribute_value'] ?? '') !== '') {
            $attributes[] = ['name' => $data['attribute_name'], 'value' => $data['attribute_value']];
        }

        foreach ($data as $key => $value) {
            if (str_starts_with((string) $key, 'spec_') && $value !== '' && $value !== null) {
                $attributes[] = ['name' => ucwords(str_replace('_', ' ', substr((string) $key, 5))), 'value' => $value];
            }
        }

        $createdCount = 0;
        foreach ($attributes as $attribute) {
            if (! is_array($attribute)) {
                continue;
            }
            $name = trim((string) ($attribute['name'] ?? $attribute['attribute_name'] ?? ''));
            $value = trim((string) ($attribute['value'] ?? $attribute['attribute_value'] ?? ''));
            if ($name === '' || $value === '') {
                continue;
            }
            ProductAttribute::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'attribute_name' => $name,
                ],
                [
                    'attribute_value' => $value,
                    'source' => 'import',
                ]
            );
            $createdCount++;
        }

        // Tidak ada spesifikasi di baris import: isi dari template per sub model
        // (ADR-019). Tidak menimpa apa pun bila template kosong.
        if ($createdCount === 0) {
            app(\App\Services\AttributeTemplateService::class)->applyToProduct($product);
        }
    }

    protected function mediaUpserter(): ProductMediaStubUpserter
    {
        return new ProductMediaStubUpserter($this->jobId);
    }

    public function chunkSize(): int
    {
        return 1000;
    }

    protected function deriveShortName(array $data): string
    {
        $provided = trim((string) ($data['short_name'] ?? ''));
        if ($provided !== '') {
            return $provided;
        }
        $name = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
        $fallback = trim((string) ($data['parent_sku'] ?? ''));
        return \App\Support\CatalogLabels::titleCaseIndonesia($name) ?: $fallback;
    }

    protected function deriveKeywords(array $data, string $categoryCode): string
    {
        $provided = trim((string) ($data['search_keywords'] ?? $data['keywords'] ?? ''));
        if ($provided !== '') {
            return $provided;
        }
        $parts = array_filter([
            \App\Support\CatalogLabels::category($categoryCode) ?: $categoryCode,
            \App\Support\CatalogLabels::model((string) ($data['product_model'] ?? '')),
            \App\Support\CatalogLabels::design((string) ($data['design_variant'] ?? '')),
            trim((string) ($data['name'] ?? '')),
        ]);
        return implode(', ', array_unique(array_filter($parts)));
    }


    protected function generateParentSku(): string
    {
        do {
            $sku = 'RGL-'.random_int(100000, 999999);
        } while (Product::where('parent_sku', $sku)->exists());

        return $sku;
    }

}
