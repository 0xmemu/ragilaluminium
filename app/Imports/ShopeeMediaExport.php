<?php

namespace App\Imports;

use App\Jobs\DownloadProductMedia;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductMedia;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Row;

/**
 * Adapter for the Shopee "mass_update_media_info" export.
 *
 * Maps product_id (col 0) to a cover image (col 4) plus item images
 * (cols 5-12) and syncs product_media for the matching product
 * (parent_sku = "SP" + product_id). Real data starts at sheet row 6.
 *
 * Re-import replaces the catalog cover/main image from the file so stale
 * or cross-product Shopee URLs do not keep winning on the storefront.
 */
class ShopeeMediaExport implements OnEachRow, WithChunkReading
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

        if ($rowIndex < 6) {
            return;
        }

        $productId = isset($data[0]) ? (string) $data[0] : '';
        if (! ctype_digit($productId)) {
            return;
        }

        $parentSku = 'SP'.$productId;
        $product = Product::where('parent_sku', $parentSku)->first();

        if (! $product) {
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => ['product_id' => $productId],
                'status' => 'failed',
                'error_reason' => 'Produk tidak ditemukan untuk product_id '.$productId,
                'processed_at' => now(),
            ]);
            $job->increment('failed_rows');

            return;
        }

        $urls = $this->urlsFromRow($data);
        if ($urls === []) {
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => ['product_id' => $productId],
                'status' => 'failed',
                'error_reason' => 'Tidak ada URL foto valid di baris media',
                'processed_at' => now(),
            ]);
            $job->increment('failed_rows');

            return;
        }

        try {
            $created = $this->syncProductMedia($product, $urls);

            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => ['product_id' => $productId, 'media' => $created],
                'status' => 'success',
                'linked_product_id' => $product->id,
                'processed_at' => now(),
            ]);
            $job->increment('success_rows');
        } catch (\Throwable $e) {
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => ['product_id' => $productId],
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'processed_at' => now(),
            ]);
            $job->increment('failed_rows');
        }
    }

    /**
     * @param  array<int, mixed>  $data
     * @return array<int, string> position => url
     */
    public function urlsFromRow(array $data): array
    {
        $urls = [];
        if (! empty($data[4]) && is_string($data[4]) && filter_var($data[4], FILTER_VALIDATE_URL)) {
            $urls[1] = $data[4];
        }
        for ($i = 5; $i <= 12; $i++) {
            $url = $data[$i] ?? null;
            if (is_string($url) && filter_var($url, FILTER_VALIDATE_URL)) {
                $urls[$i - 3] = $url; // position 2..9
            }
        }

        return $urls;
    }

    /**
     * @param  array<int, string>  $urls
     */
    public function syncProductMedia(Product $product, array $urls): int
    {
        $keepUrls = array_values($urls);
        $touched = 0;

        foreach ($urls as $position => $url) {
            $media = ProductMedia::query()
                ->where('product_id', $product->id)
                ->where('source_url', $url)
                ->whereNull('product_variant_id')
                ->first();

            if (! $media) {
                $media = new ProductMedia([
                    'product_id' => $product->id,
                    'source_url' => $url,
                    'status' => 'pending',
                    'created_by_import_job_id' => $this->jobId,
                ]);
            }

            $media->fill([
                'position' => $position,
                'show_in_catalog' => true,
                'is_installation' => false,
                'visibility' => 'visible',
                'last_updated_by_import_job_id' => $this->jobId,
            ]);

            if ($media->status === 'failed') {
                $media->status = 'pending';
                $media->error_reason = null;
            }

            $media->save();
            $touched++;

            if (in_array($media->status, ['pending', 'failed'], true)) {
                DownloadProductMedia::dispatch($media->id);
            }
        }

        // Cover dari file = foto utama storefront.
        ProductMedia::query()
            ->where('product_id', $product->id)
            ->whereNull('product_variant_id')
            ->update(['is_main_image' => false]);

        if (isset($urls[1])) {
            ProductMedia::query()
                ->where('product_id', $product->id)
                ->where('source_url', $urls[1])
                ->whereNull('product_variant_id')
                ->update(['is_main_image' => true]);
        }

        // Sembunyikan foto katalog lama (hasil import) yang tidak lagi di file Shopee,
        // supaya cover boven yang salah tidak tetap tampil di kartu.
        ProductMedia::query()
            ->where('product_id', $product->id)
            ->whereNull('product_variant_id')
            ->where('show_in_catalog', true)
            ->where('is_installation', false)
            ->whereNotNull('source_url')
            ->whereNotIn('source_url', $keepUrls)
            ->whereNull('created_by_user_id')
            ->update([
                'is_main_image' => false,
                'show_in_catalog' => false,
                'visibility' => 'hidden',
                'last_updated_by_import_job_id' => $this->jobId,
            ]);

        return $touched;
    }

    public function chunkSize(): int
    {
        return 1000;
    }
}
