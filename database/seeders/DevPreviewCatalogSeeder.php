<?php

namespace Database\Seeders;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Support\CodSettings;
use App\Support\FlashSalePeriodSettings;
use App\Support\HomepagePromotionSettings;
use App\Support\ShippingSubsidySettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Isi katalog sintetis untuk live dev preview.
 *
 * Idempotent: hanya menyentuh data dengan parent_sku DEVPREVIEW-* dan
 * testimonial/gallery yang dibuat seeder ini.
 *
 * php artisan db:seed --class=DevPreviewCatalogSeeder
 */
class DevPreviewCatalogSeeder extends Seeder
{
    private const IMAGE_URLS = [
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=82',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=82',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=82',
        'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1400&q=82',
        'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=82',
        'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=82',
    ];

    private const CATEGORY_LABELS = [
        'WINDOW' => 'Jendela',
        'DOOR' => 'Pintu',
        'BOUVEN' => 'Bouven',
    ];

    private const MODEL_LABELS = [
        'JUNGKIT' => 'Jungkit',
        'SLIDING' => 'Sliding',
        'SWING' => 'Swing',
        'KACA_MATI' => 'Kaca Mati',
        'ZIGZAG' => 'Zigzag',
    ];

    private const DESIGN_LABELS = [
        'POLOS' => 'Polos',
        'ORNAMEN' => 'Ornamen',
        'KOMBINASI' => 'Kombinasi',
        'SERIES_A' => 'Series A',
        'SERIES_B' => 'Series B',
        'SERIES_C' => 'Series C',
    ];

    public function run(): void
    {
        $products = collect();

        DB::transaction(function () use (&$products): void {
            $this->ensureCmsPages();

            for ($index = 1; $index <= 50; $index++) {
                $products->push($this->seedProduct($index));
            }

            $this->seedCampaignSettings();
            $this->seedInstallationGallery($products);
        });

        $this->command?->info('Dev preview catalog: 50 produk, 100 varian, promo, ulasan, media, dan instalasi siap.');
        $this->command?->info('Flash Sale live 14 hari, subsidi ongkir J&T 50%, JNT_ENABLED tetap false.');
    }

    private function seedProduct(int $index): Product
    {
        $category = ['WINDOW', 'DOOR', 'BOUVEN'][($index - 1) % 3];
        $modelsByCategory = [
            'WINDOW' => ['JUNGKIT', 'SLIDING', 'SWING', 'KACA_MATI', 'ZIGZAG'],
            'DOOR' => ['SWING', 'SLIDING', 'ZIGZAG', 'KACA_MATI', 'JUNGKIT'],
            'BOUVEN' => ['JUNGKIT', 'KACA_MATI', 'SLIDING', 'ZIGZAG', 'SWING'],
        ];
        $model = $modelsByCategory[$category][($index - 1) % 5];
        $design = array_keys(self::DESIGN_LABELS)[($index - 1) % count(self::DESIGN_LABELS)];
        $categoryLabel = self::CATEGORY_LABELS[$category];
        $modelLabel = self::MODEL_LABELS[$model];
        $designLabel = self::DESIGN_LABELS[$design];
        $isFlashSale = $index <= 30;
        $discountPercent = 10 + (($index - 1) % 5) * 5;
        $salePrice = 650000 + ($index * 27500);
        $comparePrice = (int) round($salePrice / (1 - ($discountPercent / 100)));
        $image = self::IMAGE_URLS[($index - 1) % count(self::IMAGE_URLS)];
        $altImage = self::IMAGE_URLS[$index % count(self::IMAGE_URLS)];
        $sku = sprintf('DEVPREVIEW-%03d', $index);

        $product = Product::updateOrCreate(
            ['parent_sku' => $sku],
            [
                'name' => sprintf('%s Aluminium %s %s %02d', $categoryLabel, $modelLabel, $designLabel, $index),
                'short_name' => sprintf('%s %s %02d', $categoryLabel, $modelLabel, $index),
                'description' => sprintf(
                    'Produk preview dev %s aluminium model %s desain %s. Siap untuk ukuran custom, kaca pilihan, dan kebutuhan hunian maupun proyek.',
                    strtolower($categoryLabel),
                    strtolower($modelLabel),
                    strtolower($designLabel)
                ),
                'category_id' => match ($category) {
                    'WINDOW' => 1,
                    'DOOR' => 2,
                    default => 3,
                },
                'product_category' => $category,
                'product_model' => $model,
                'design_variant' => $design,
                'status' => 'active',
                'homepage_popular' => $index <= 10,
                'homepage_popular_sort' => $index <= 10 ? $index : 0,
            ]
        );

        $this->seedVariants($product, $salePrice, $index);
        $this->seedAttributes($product, $comparePrice, $isFlashSale, $index);
        $this->seedMedia($product, $image, $altImage, $index);
        $this->seedReview($product, $image, $index);

        return $product;
    }

    private function seedVariants(Product $product, int $salePrice, int $index): void
    {
        $options = [
            ['Silver', 'Bening', 0],
            ['Coklat', 'Rayban', 75000],
        ];

        foreach ($options as $variantIndex => [$color, $glass, $surcharge]) {
            ProductVariant::updateOrCreate(
                ['variant_sku' => sprintf('DEVPREVIEW-%03d-V%d', $index, $variantIndex + 1)],
                [
                    'product_id' => $product->id,
                    'variation_1_name' => 'Warna Frame',
                    'variation_1_option' => $color,
                    'variation_2_name' => 'Jenis Kaca',
                    'variation_2_option' => $glass,
                    'price' => $salePrice + $surcharge,
                    'stock' => 8 + (($index + $variantIndex) % 17),
                    'weight_kg' => 7.5 + (($index % 8) * 0.75) + ($variantIndex * 0.5),
                    'width_cm' => 60 + (($index % 6) * 10),
                    'height_cm' => 80 + (($index % 7) * 10),
                    'depth_cm' => 5.0,
                    'status' => 'active',
                ]
            );
        }
    }

    private function seedAttributes(Product $product, int $comparePrice, bool $isFlashSale, int $index): void
    {
        $attributes = [
            'promo_compare_price' => (string) $comparePrice,
            'promo_flash_sale' => $isFlashSale ? 'true' : 'false',
            'promo_cod' => 'true',
            'promo_warranty' => '1 tahun',
            'material' => 'Aluminium powder coating',
            'ketebalan_frame' => $index % 2 === 0 ? '1.2 mm' : '1.0 mm',
            'perawatan' => 'Mudah dibersihkan',
        ];

        foreach ($attributes as $name => $value) {
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
    }

    private function seedMedia(Product $product, string $image, string $altImage, int $index): void
    {
        $media = [
            [1, true, true, false, $image, null],
            [2, false, true, false, $altImage, null],
            [3, false, false, true, $image, 'Contoh hasil pemasangan di area hunian'],
            [4, false, false, true, $altImage, 'Detail frame dan finishing setelah terpasang'],
        ];

        foreach ($media as [$position, $main, $catalog, $installation, $url, $caption]) {
            ProductMedia::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'position' => $position,
                    'is_installation' => $installation,
                ],
                [
                    'product_variant_id' => null,
                    'is_main_image' => $main,
                    'show_in_catalog' => $catalog,
                    'is_installation' => $installation,
                    'installation_caption' => $caption,
                    'visibility' => 'visible',
                    'source_url' => $url,
                    'stored_path' => null,
                    'stored_url' => $url,
                    'derivatives' => null,
                    'mime_type' => 'image/jpeg',
                    'size_bytes' => null,
                    'width_px' => 1400,
                    'height_px' => 933,
                    'status' => 'downloaded',
                    'error_reason' => null,
                ]
            );
        }
    }

    private function seedReview(Product $product, string $image, int $index): void
    {
        $names = [
            'Budi Santoso', 'Siti Rahmawati', 'Agus Prasetyo', 'Dewi Lestari', 'Rizky Ramadhan',
            'Nurul Hidayah', 'Hendra Wijaya', 'Maya Anggraini', 'Fajar Nugroho', 'Indah Permatasari',
        ];
        $cities = ['Banjarnegara', 'Yogyakarta', 'Semarang', 'Bandung', 'Jakarta', 'Surabaya', 'Solo', 'Bekasi'];
        $messages = [
            'Finishing rapi, ukuran sesuai, dan frame terasa kokoh setelah terpasang.',
            'Admin membantu memilih model dan jenis kaca. Barang datang aman dengan packing kuat.',
            'Tampilannya modern, bukaan halus, dan cocok untuk rumah minimalis.',
            'Kualitas sepadan dengan harga. Detail produk sesuai foto dan deskripsi.',
            'Sudah terpasang di rumah, hasilnya bersih dan ruangan terasa lebih terang.',
        ];

        CmsTestimonial::updateOrCreate(
            [
                'product_id' => $product->id,
                'customer_name' => 'Preview · '.$names[($index - 1) % count($names)],
                'sort_order' => 1000 + $index,
            ],
            [
                'cms_page_id' => CmsPage::query()->where('slug', 'testimoni')->value('id'),
                'message' => $messages[($index - 1) % count($messages)],
                'rating' => 4 + ($index % 2),
                'source' => $index % 3 === 0 ? 'website' : ($index % 3 === 1 ? 'whatsapp' : 'shopee'),
                'location' => $cities[($index - 1) % count($cities)].', Indonesia',
                'image_url' => $image,
                'published' => true,
            ]
        );
    }

    private function ensureCmsPages(): void
    {
        CmsPage::updateOrCreate(
            ['slug' => 'testimoni'],
            ['title' => 'Testimoni & Ulasan', 'content' => ['heading' => 'Apa kata pelanggan'], 'published' => true]
        );

        CmsPage::updateOrCreate(
            ['slug' => 'hasil-pemasangan'],
            ['title' => 'Hasil Pemasangan', 'content' => ['heading' => 'Hasil pemasangan produk Ragil Aluminium'], 'published' => true]
        );
    }

    private function seedInstallationGallery($products): void
    {
        $pageId = CmsPage::query()->where('slug', 'hasil-pemasangan')->value('id');

        foreach ($products->take(12) as $index => $product) {
            $image = self::IMAGE_URLS[$index % count(self::IMAGE_URLS)];
            CmsGalleryItem::updateOrCreate(
                ['cms_page_id' => $pageId, 'sort_order' => 2000 + $index],
                [
                    'image_url' => $image,
                    'label' => 'Instalasi '.$product->short_name,
                    'published' => true,
                ]
            );
        }
    }

    private function seedCampaignSettings(): void
    {
        HomepagePromotionSettings::update(['enabled' => true, 'max_slides' => 5]);

        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(14)->toDateTimeString(),
        ]);

        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ]);

        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 0,
            'max_order_amount' => null,
        ]);
    }
}
