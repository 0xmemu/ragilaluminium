<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\StoreVoucher;
use App\Models\User;
use App\Services\ModelProductService;
use App\Support\CodSettings;
use App\Support\FlashSalePeriodSettings;
use App\Support\HomepageLayoutSettings;
use App\Support\HomepagePromotionSettings;
use App\Support\ShippingSubsidySettings;
use App\Support\StorefrontPlatformSettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * Isi konten storefront yang tersambung ke admin/CMS untuk pengujian frontend end-to-end.
 * Idempotent. Prasyarat: katalog produk + media sudah ada.
 *
 * php artisan db:seed --class=StorefrontQaSeeder
 */
class StorefrontQaSeeder extends Seeder
{
    public function run(): void
    {
        $productCount = Schema::hasTable('products') ? Product::query()->count() : 0;
        if ($productCount < 1) {
            $this->command?->error('StorefrontQaSeeder dibatalkan: belum ada produk. Import katalog dulu.');

            return;
        }

        $this->command?->info("Katalog siap ({$productCount} produk). Mengisi konten QA…");

        $this->call([
            CmsPageSeeder::class,
            FaqSeeder::class,
            ProductCardPromotionSeeder::class,
            TestimonialSeeder::class,
        ]);

        $this->seedHomepageSettings();
        $this->seedCheckoutSettings();
        $this->seedFlashSalePeriod();
        $this->seedPlatformLinks();
        $this->seedPopularProducts();
        $this->seedInstallationMedia();
        $this->seedModelProducts();
        $this->seedQaVoucher();

        $this->call([
            StorefrontDocumentSeeder::class,
        ]);

        $this->command?->info('StorefrontQaSeeder selesai. Uji: /, /promo, /flash-sale, /reviews, /faq, /about, /privacy, /terms, /hasil-pemasangan, /checkout.');
    }

    protected function seedHomepageSettings(): void
    {
        HomepagePromotionSettings::update([
            'enabled' => true,
            'max_slides' => 5,
        ]);

        HomepageLayoutSettings::updateSections([
            ['key' => 'banner', 'enabled' => true, 'sort_order' => 0],
            ['key' => 'how_to_order', 'enabled' => true, 'sort_order' => 1],
        ]);

        HomepageLayoutSettings::updateHowToOrder([
            'title' => 'Cara pesan jendela Anda',
            'subtitle' => 'Tiga langkah mudah dari memilih model sampai konfirmasi WhatsApp.',
            'steps' => [
                ['title' => 'Pilih model', 'description' => 'Tentukan model jendela, pintu, atau bouven yang sesuai kebutuhan.'],
                ['title' => 'Pilih ukuran & varian', 'description' => 'Atur ukuran, desain, dan opsi di halaman produk.'],
                ['title' => 'Proses pesanan & konfirmasi WhatsApp', 'description' => 'Checkout, lalu tim kami proses pesanan dan konfirmasi lewat WhatsApp.'],
            ],
        ]);

        $this->command?->info('Beranda: auto promo + layout + cara pesan aktif.');
    }

    protected function seedCheckoutSettings(): void
    {
        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 0,
            'max_order_amount' => null,
        ]);

        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ]);

        $this->command?->info('Checkout: COD aktif, subsidi ongkir J&T 50%.');
    }

    protected function seedFlashSalePeriod(): void
    {
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subDay()->toDateTimeString(),
            'ends_at' => now()->addDays(14)->toDateTimeString(),
        ]);

        $this->command?->info('Flash Sale periode: live 14 hari ke depan.');
    }

    protected function seedPlatformLinks(): void
    {
        StorefrontPlatformSettings::update([
            'shopee' => 'https://shopee.co.id/ragilaluminium',
            'tokopedia' => 'https://www.tokopedia.com/ragilaluminium',
            'lazada' => 'https://www.lazada.co.id/shop/ragil-aluminium',
            'tiktok_shop' => 'https://www.tiktok.com/@ragilaluminium',
            'instagram' => 'https://www.instagram.com/ragilaluminium',
            'tiktok' => 'https://www.tiktok.com/@ragilaluminium',
            'youtube' => 'https://www.youtube.com/@ragilaluminium',
            'facebook' => 'https://www.facebook.com/ragilaluminium',
        ]);

        $this->command?->info('Marketplace & sosmed: URL demo terisi.');
    }

    protected function seedPopularProducts(): void
    {
        Product::query()->update([
            'homepage_popular' => false,
            'homepage_popular_sort' => 0,
        ]);

        $picked = Product::query()
            ->visible()
            ->whereHas('mainImage')
            ->orderBy('id')
            ->limit(10)
            ->get();

        if ($picked->isEmpty()) {
            $picked = Product::query()->visible()->orderBy('id')->limit(10)->get();
        }

        foreach ($picked as $index => $product) {
            $product->update([
                'homepage_popular' => true,
                'homepage_popular_sort' => $index + 1,
            ]);
        }

        $this->command?->info('Home popular: '.$picked->count().' produk ditandai homepage_popular.');
    }

    protected function seedInstallationMedia(): void
    {
        if (! Schema::hasTable('product_media')) {
            return;
        }

        $media = ProductMedia::query()
            ->where('status', 'downloaded')
            ->whereNotNull('stored_url')
            ->orderBy('id')
            ->limit(12)
            ->get();

        if ($media->isEmpty()) {
            $media = ProductMedia::query()
                ->whereNotNull('source_url')
                ->orderBy('id')
                ->limit(12)
                ->get();
        }

        foreach ($media as $row) {
            $row->update([
                'is_installation' => true,
                'visibility' => $row->visibility ?: 'visible',
            ]);
        }

        $this->command?->info('Hasil pemasangan: '.$media->count().' product_media.is_installation.');
    }

    protected function seedModelProducts(): void
    {
        $created = app(ModelProductService::class)->syncFromCatalog();
        $this->command?->info("Model produk CMS: syncFromCatalog (+{$created} baru).");
    }

    protected function seedQaVoucher(): void
    {
        if (! Schema::hasTable('store_vouchers')) {
            return;
        }

        // Hanya satu voucher published sekaligus (aturan domain).
        StoreVoucher::query()->where('published', true)->update(['published' => false]);

        $adminId = User::query()->where('role', 'admin')->value('id');

        StoreVoucher::query()->updateOrCreate(
            ['code' => 'QA10'],
            [
                'name' => 'Voucher Uji Frontend 10%',
                'discount_type' => 'percent',
                'discount_value' => 10,
                'min_purchase' => 100000,
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addMonth(),
                'published' => true,
                'created_by_user_id' => $adminId,
                'updated_by_user_id' => $adminId,
            ]
        );

        $this->command?->info('Voucher published: QA10 (10%, min Rp100.000).');
    }
}
