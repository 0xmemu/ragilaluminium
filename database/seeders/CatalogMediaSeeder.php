<?php

namespace Database\Seeders;

use App\Jobs\DownloadProductMedia;
use App\Models\Product;
use App\Models\ProductMedia;
use Illuminate\Database\Seeder;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Mengisi product_media untuk produk katalog yang sudah ada dengan gambar dari
 * file media Shopee (sim_20_media.xlsx). Tidak mengunduh gambar di sini — hanya
 * membuat record ProductMedia (status pending) lalu men-dispatch job
 * DownloadProductMedia per row. Job yang mengunduh, mengkonversi ke WebP
 * (thumb/card/pdp via MediaDerivativeService), dan mengunggah ke disk `media`.
 *
 * Strategi storage efisien: keep_original=false (default) → hanya WebP disimpan
 * di disk, original JPG dihapus setelah derivative sukses.
 *
 * Idempotent: media yang sudah ada per product di-skip.
 *
 * php artisan db:seed --class=CatalogMediaSeeder
 */
class CatalogMediaSeeder extends Seeder
{
    private const MEDIA_XLSX = 'storage/app/imports/catalog/2026-07-24-6a62ae86868e3-sim_20_media.xlsx';

    private const IMAGE_COLUMNS = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

    public function run(): void
    {
        $products = Product::query()->orderBy('id')->get();
        if ($products->isEmpty()) {
            $this->command?->error('CatalogMediaSeeder dibatalkan: belum ada produk.');

            return;
        }

        $urls = $this->collectShopeeImageUrls();
        if ($urls === []) {
            $this->command?->error('CatalogMediaSeeder: tidak ada URL gambar di '.self::MEDIA_XLSX);

            return;
        }

        $this->command?->info('Menyiapkan product_media untuk '.$products->count().' produk dari '.count($urls).' URL Shopee (akan dikonversi WebP oleh queue).');

        $urlIndex = 0;
        $created = 0;
        $skipped = 0;
        $dispatched = 0;

        foreach ($products as $product) {
            $existing = ProductMedia::query()
                ->where('product_id', $product->id)
                ->count();

            if ($existing > 0) {
                $skipped++;
                continue;
            }

            // 1 main image + 1 gallery image per product (jika URL cukup)
            for ($position = 1; $position <= 2; $position++) {
                $url = $urls[$urlIndex % count($urls)];
                $urlIndex++;

                $media = ProductMedia::create([
                    'product_id' => $product->id,
                    'product_variant_id' => null,
                    'position' => $position,
                    'is_main_image' => $position === 1,
                    'show_in_catalog' => true,
                    'is_installation' => false,
                    'visibility' => 'visible',
                    'source_url' => $url,
                    'stored_path' => null,
                    'stored_url' => null,
                    'derivatives' => null,
                    'mime_type' => null,
                    'size_bytes' => null,
                    'width_px' => null,
                    'height_px' => null,
                    'status' => 'pending',
                    'error_reason' => null,
                ]);
                $created++;

                DownloadProductMedia::dispatch($media->id);
                $dispatched++;
            }
        }

        $this->command?->info("CatalogMediaSeeder selesai. created=$created dispatched=$dispatched skipped=$skipped");
        $this->command?->info('Jalankan `php artisan queue:work` (atau tunggu worker yang sudah berjalan) untuk memproses konversi WebP.');
    }

    /**
     * @return list<string>
     */
    private function collectShopeeImageUrls(): array
    {
        $path = base_path(self::MEDIA_XLSX);
        if (! file_exists($path)) {
            return [];
        }

        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $book = $reader->load($path);
        $sheet = $book->getActiveSheet();
        $maxRow = $sheet->getHighestRow();

        $urls = [];
        for ($r = 6; $r <= $maxRow; $r++) {
            foreach (self::IMAGE_COLUMNS as $col) {
                $val = $sheet->getCell($col.$r)->getCalculatedValue();
                if (is_string($val) && str_starts_with($val, 'https://')) {
                    $urls[] = $val;
                }
            }
        }

        return array_values(array_unique($urls));
    }
}
