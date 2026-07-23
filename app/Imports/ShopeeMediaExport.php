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
 * (cols 5-12) and creates product_media stubs for the matching product
 * (parent_sku = "SP" + product_id). Real data starts at sheet row 6.
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

        // col 4 = cover, cols 5..12 = item images 1..8
        $urls = [];
        if (! empty($data[4])) {
            $urls[1] = (string) $data[4];
        }
        for ($i = 5; $i <= 12; $i++) {
            if (! empty($data[$i])) {
                $urls[$i - 3] = (string) $data[$i]; // position 2..9
            }
        }

        $created = 0;
        try {
            foreach ($urls as $position => $url) {
                if (! filter_var($url, FILTER_VALIDATE_URL)) {
                    continue;
                }
                $media = ProductMedia::firstOrCreate(
                    [
                        'product_id' => $product->id,
                        'source_url' => $url,
                    ],
                    [
                        'position' => $position,
                        'is_main_image' => $position === 1,
                        'show_in_catalog' => true,
                        'is_installation' => false,
                        'visibility' => 'visible',
                        'status' => 'pending',
                        'created_by_import_job_id' => $this->jobId,
                    ]
                );
                if ($media->status === 'pending') {
                    DownloadProductMedia::dispatch($media->id);
                }
                $created++;
            }

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

    public function chunkSize(): int
    {
        return 1000;
    }
}
