<?php

namespace Database\Seeders;

use App\Jobs\DownloadProductMedia;
use App\Models\CmsBanner;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Support\CategoryUrl;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class ProductCardPromotionSeeder extends Seeder
{
    /**
     * Seed real flash-sale attributes + published Promo Toko banners (not UI mocks).
     * Visible on /promo, home hero (if auto_promotions), admin Flash Sale & Promo Toko, dashboard promo strip.
     */
    public function run(): void
    {
        ProductAttribute::where('source', 'internal')
            ->whereIn('attribute_name', ['promo_compare_price', 'promo_flash_sale'])
            ->delete();

        $picked = collect();

        foreach (CategoryUrl::productCategoryCodes() as $category) {
            $batch = Product::visible()
                ->where('product_category', $category)
                ->whereHas('activeVariants', fn ($query) => $query->where('price', '>', 0))
                ->with(['activeVariants', 'media' => fn ($query) => $query->orderBy('position'), 'mainImage'])
                ->orderBy('id')
                ->limit(2)
                ->get();
            $picked = $picked->concat($batch);
        }

        if ($picked->isEmpty()) {
            $picked = Product::visible()
                ->whereHas('activeVariants', fn ($query) => $query->where('price', '>', 0))
                ->with(['activeVariants', 'media' => fn ($query) => $query->orderBy('position'), 'mainImage'])
                ->orderBy('id')
                ->limit(6)
                ->get();
        }

        $picked = $picked->unique('id')->take(6)->values();

        if ($picked->isEmpty()) {
            $this->command?->warn('Tidak ada produk aktif untuk dipromo.');

            return;
        }

        $sort = 10;
        foreach ($picked as $index => $product) {
            $salePrice = (float) $product->activeVariants->min('price');
            if ($salePrice <= 0) {
                continue;
            }

            // Variasikan diskon 15% / 20% / 25% agar kartu tidak seragam.
            $discount = [0.15, 0.2, 0.25][$index % 3];
            $comparePrice = (int) round($salePrice / (1 - $discount));

            foreach ([
                'promo_compare_price' => (string) $comparePrice,
                'promo_flash_sale' => 'true',
            ] as $name => $value) {
                ProductAttribute::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'attribute_name' => $name,
                        'source' => 'internal',
                    ],
                    [
                        'product_variant_id' => null,
                        'attribute_value' => $value,
                    ]
                );
            }

            $main = $product->mainImage
                ?: ($product->media->firstWhere('is_main_image', true) ?: $product->media->first());

            $imageUrl = $main?->display_url
                ?: $main?->stored_url
                ?: ($main?->source_url ?: null);

            if ($main && blank($main->stored_url) && filled($main->source_url)) {
                try {
                    DownloadProductMedia::dispatchSync($main->id);
                    $main->refresh();
                    $imageUrl = $main->display_url ?: $main->stored_url ?: $main->source_url;
                } catch (\Throwable $e) {
                    $this->command?->warn("Media download skip {$product->parent_sku}: ".$e->getMessage());
                    $imageUrl = $main->source_url;
                }
            }

            if (Schema::hasTable('cms_banners') && filled($imageUrl)) {
                $title = 'Flash Sale '.((int) round($discount * 100)).'% · '.($product->short_name ?: $product->name);
                CmsBanner::updateOrCreate(
                    ['link_url' => '/product/'.$product->parent_sku],
                    [
                        'title' => \Illuminate\Support\Str::limit($title, 80, ''),
                        'image_url' => $imageUrl,
                        'sort_order' => $sort,
                        'published' => true,
                    ]
                );
                $sort += 10;
            }

            $this->command?->info(sprintf(
                'Promo %d%% aktif: %s (%s)',
                (int) round($discount * 100),
                $product->parent_sku,
                $product->product_category
            ));
        }

        $this->command?->info('Selesai: '.$picked->count().' produk flash sale + banner Promo Toko (jika media tersedia).');
    }
}
