<?php

namespace App\Imports;

use App\Jobs\DownloadMediaAsset;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Services\MediaAssetResolver;
use App\Services\ImportedProductActivationService;
use App\Support\InstallationGallery;
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
            if ($parentSku === '') {
                throw new \RuntimeException('parent_sku kosong');
            }

            $product = Product::updateOrCreate(
                ['parent_sku' => $parentSku],
                [
                    'name' => $data['name'] ?? $data['product_name'] ?? $parentSku,
                    'short_name' => $data['short_name'] ?? null,
                    'description' => $data['description'] ?? null,
                    'category_id' => (int) ($data['category_id'] ?? 0),
                    'product_category' => strtoupper($data['product_category'] ?? 'WINDOW'),
                    'product_model' => \App\Support\CatalogLabels::normalizeModel($data['product_model'] ?? 'SLIDING') ?? 'SLIDING',
                    'design_variant' => \App\Support\CatalogLabels::normalizeDesign($data['design_variant'] ?? 'POLOS') ?? 'POLOS',
                    'status' => 'archived',
                ]
            );

            $variantSku = trim((string) ($data['variant_sku'] ?? ''));
            $variant = null;
            if ($variantSku !== '') {
                $stock = $job->stock_mode === 'manual'
                    ? (int) $job->manual_stock
                    : (int) ($data['stock'] ?? 0);
                $variant = ProductVariant::updateOrCreate(
                    ['variant_sku' => $variantSku],
                    [
                        'product_id' => $product->id,
                        'variation_1_name' => $data['variation_1_name'] ?? null,
                        'variation_1_option' => $data['variation_1_option'] ?? null,
                        'variation_2_name' => $data['variation_2_name'] ?? null,
                        'variation_2_option' => $data['variation_2_option'] ?? null,
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
                    $this->upsertMediaStub(
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
                    $this->upsertMediaStub(
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
        }
    }

    protected function upsertMediaStub(
        int $productId,
        ?int $variantId,
        string $url,
        int $position,
        bool $isMain,
        bool $showInCatalog,
        bool $isInstallation,
    ): void {
        $asset = app(MediaAssetResolver::class)->fromSourceUrl($url, jobId: $this->jobId);
        $mediaQuery = ProductMedia::query()
            ->where('product_id', $productId)
            ->where('media_asset_id', $asset->id);
        if ($variantId === null) {
            $mediaQuery->whereNull('product_variant_id');
        } else {
            $mediaQuery->where('product_variant_id', $variantId);
        }
        $media = $mediaQuery->first() ?? new ProductMedia([
            'product_id' => $productId,
            'product_variant_id' => $variantId,
            'media_asset_id' => $asset->id,
            'source_url' => $url,
            'created_by_import_job_id' => $this->jobId,
        ]);

        $updates = [
            'last_updated_by_import_job_id' => $this->jobId,
            'media_asset_id' => $asset->id,
            'source_url' => $url,
            'status' => $asset->status === 'ready' ? 'downloaded' : 'pending',
            'position' => $showInCatalog ? $position : ($media->position ?: $position),
            'is_main_image' => $showInCatalog && $isMain ? true : (bool) $media->is_main_image,
            'show_in_catalog' => $showInCatalog || (bool) $media->show_in_catalog,
            'is_installation' => $isInstallation || (bool) $media->is_installation,
        ];

        if ($updates['is_main_image']) {
            ProductMedia::where('product_id', $productId)
                ->where('id', '!=', $media->id)
                ->update(['is_main_image' => false]);
        }
        $media->fill($updates)->save();

        if ($asset->status === 'pending') {
            DownloadMediaAsset::dispatch($asset->id);
        }
    }

    public function chunkSize(): int
    {
        return 1000;
    }
}
