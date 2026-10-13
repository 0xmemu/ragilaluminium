<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductMedia;
use Illuminate\Database\Seeder;

/**
 * Mengisi product_media is_installation=true untuk setiap produk (2 foto per
 * produk) dengan meminjam URL media produk yang sudah ada — sehingga gambar
 * hasil pemasangan cocok dengan model produknya.
 *
 * Idempotent: produk yang sudah punya installation media di-skip.
 *
 * php artisan db:seed --class=InstallationMediaSeeder
 */
class InstallationMediaSeeder extends Seeder
{
    public function run(): void
    {
        $products = Product::query()->orderBy('id')->get(['id', 'name']);

        if ($products->isEmpty()) {
            $this->command?->error('InstallationMediaSeeder dibatalkan: belum ada produk.');

            return;
        }

        $created = 0;
        $skipped = 0;

        foreach ($products as $product) {
            $existingInst = ProductMedia::query()
                ->where('product_id', $product->id)
                ->where('is_installation', true)
                ->count();

            if ($existingInst > 0) {
                $skipped++;
                continue;
            }

            // Ambil 2 media non-installation yang sudah punya file (status downloaded)
            $sourceMedia = ProductMedia::query()
                ->where('product_id', $product->id)
                ->where('is_installation', false)
                ->whereNotNull('stored_url')
                ->orderBy('position')
                ->limit(2)
                ->get();

            if ($sourceMedia->isEmpty()) {
                $this->command?->warn("Produk {$product->id} ({$product->name}): tidak ada media source, skip.");
                continue;
            }

            $maxPosition = (int) ProductMedia::query()
                ->where('product_id', $product->id)
                ->max('position') ?? 0;

            foreach ($sourceMedia as $idx => $src) {
                $position = $maxPosition + $idx + 1;
                ProductMedia::create([
                    'product_id' => $product->id,
                    'product_variant_id' => null,
                    'position' => $position,
                    'is_main_image' => false,
                    'show_in_catalog' => false,
                    'is_installation' => true,
                    'installation_caption' => "Hasil pemasangan {$product->name}",
                    'visibility' => 'visible',
                    'source_url' => $src->source_url,
                    'stored_path' => $src->stored_path,
                    'stored_url' => $src->stored_url,
                    'derivatives' => $src->derivatives,
                    'mime_type' => $src->mime_type,
                    'size_bytes' => $src->size_bytes,
                    'width_px' => $src->width_px,
                    'height_px' => $src->height_px,
                    'status' => $src->status,
                    'error_reason' => null,
                ]);
                $created++;
            }
        }

        $this->command?->info("InstallationMediaSeeder selesai. created={$created} skipped={$skipped}");
    }
}
