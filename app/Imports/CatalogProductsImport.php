<?php

namespace App\Imports;

use App\Jobs\DownloadProductMedia;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
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
            $parentSku = $data['parent_sku'] ?? null;
            if (! $parentSku) {
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
                    'status' => 'active',
                ]
            );

            $variantSku = $data['variant_sku'] ?? null;
            $variant = null;
            if ($variantSku) {
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
                        'weight_kg' => isset($data['weight']) ? (float) $data['weight'] : null,
                        'status' => 'active',
                    ]
                );
            }

            $installationSlots = InstallationGallery::parseSlots(
                isset($data['installation_slots']) ? (string) $data['installation_slots'] : null
            );

            // Catalog gallery: image_1..image_9
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

            // Extra installation docs (outside catalog gallery): installation_image_1..9
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

            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => array_merge($data, [
                    '_stock_mode' => $job->stock_mode,
                    '_effective_stock' => $variant?->stock,
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

    protected function upsertMediaStub(
        int $productId,
        ?int $variantId,
        string $url,
        int $position,
        bool $isMain,
        bool $showInCatalog,
        bool $isInstallation,
    ): void {
        $media = ProductMedia::firstOrCreate(
            [
                'product_id' => $productId,
                'source_url' => $url,
                'product_variant_id' => $variantId,
            ],
            [
                'position' => $position,
                'is_main_image' => $isMain && $showInCatalog,
                'show_in_catalog' => $showInCatalog,
                'is_installation' => $isInstallation,
                'visibility' => 'visible',
                'status' => 'pending',
                'created_by_import_job_id' => $this->jobId,
            ]
        );

        $updates = [
            'last_updated_by_import_job_id' => $this->jobId,
        ];

        // Dual-use: keep catalog visibility if already catalog; OR if this pass is catalog.
        if ($showInCatalog) {
            $updates['show_in_catalog'] = true;
            $updates['position'] = $position;
            if ($isMain) {
                $updates['is_main_image'] = true;
            }
        } elseif (! $media->wasRecentlyCreated && ! $media->show_in_catalog) {
            $updates['position'] = $position;
        }

        if ($isInstallation) {
            $updates['is_installation'] = true;
        }

        if ($updates !== ['last_updated_by_import_job_id' => $this->jobId] || $media->wasRecentlyCreated) {
            if ($media->wasRecentlyCreated && isset($updates['is_main_image']) && $updates['is_main_image']) {
                ProductMedia::where('product_id', $productId)
                    ->where('id', '!=', $media->id)
                    ->update(['is_main_image' => false]);
            }
            $media->fill($updates)->save();
        }

        if ($media->status === 'pending') {
            DownloadProductMedia::dispatch($media->id);
        }
    }

    public function chunkSize(): int
    {
        return 1000;
    }

}
