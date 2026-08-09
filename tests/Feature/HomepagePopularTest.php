<?php

namespace Tests\Feature;

use App\Models\CmsBanner;
use App\Models\CmsPage;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Models\ProductAttribute;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\CatalogTaxonomy;
use App\Support\FlashSalePeriodSettings;
use App\Support\HomepagePromotionSettings;
use App\Support\InertiaCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

class HomepagePopularTest extends \Tests\TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, string>  $attributes
     */
    private function makePromoProduct(
        string $sku,
        string $name,
        array $attributes = [],
        ?string $imageUrl = null,
        bool $homepagePopular = false,
        int $homepagePopularSort = 100,
    ): Product {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => $name,
            'short_name' => $name,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => $homepagePopular,
            'homepage_popular_sort' => $homepagePopularSort,
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-100',
            'price' => 800000,
            'stock' => 5,
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'stored_url' => $imageUrl ?? 'https://cdn.example/'.$sku.'.jpg',
            'status' => 'downloaded',
        ]);

        foreach ($attributes as $attrName => $attrValue) {
            ProductAttribute::create([
                'product_id' => $product->id,
                'attribute_name' => $attrName,
                'attribute_value' => $attrValue,
                'source' => 'internal',
            ]);
        }

        return $product;
    }

    public function test_home_prefers_curated_homepage_popular_products(): void
    {
        CatalogTaxonomy::forgetCache();

        $product = Product::create([
            'parent_sku' => 'WIN-NEW-1',
            'name' => 'Newest Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => false,
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-NEW-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-POP-2',
            'name' => 'Curated Second',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => true,
            'homepage_popular_sort' => 20,
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-POP-2-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-POP-1',
            'name' => 'Curated First',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => true,
            'homepage_popular_sort' => 10,
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-POP-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Home')
                ->has('popularProducts', 2)
                ->has('nav.public.hamburger_product', 4)
                ->where('nav.public.hamburger_product.0.label', 'Model Produk')
                ->where('nav.public.hamburger_product.1.label', 'Semua Produk')
                ->where('nav.public.hamburger_product.2.label', 'Hasil Pemasangan')
                ->has('nav.public.hamburger_info', 6)
                ->where('nav.public.hamburger_info.0.label', 'Lacak Pengiriman')
                ->where('nav.public.hamburger_info.5.label', 'Informasi Toko')
                ->has('nav.public.hamburger', 10)
                ->has('nav.public.desktop_main', 5)
                ->where('nav.public.desktop_main.0.label', 'Model Produk')
                ->where('nav.public.desktop_main.4.label', 'Informasi Toko')
                ->has('nav.public.model_menu', 3)
                ->where('nav.public.model_menu.0.label', 'Jendela Aluminium Jungkit')
                ->where('modelCards.0.meta', '3 Model Kaca | 4 Model Warna')
                ->where('popularProducts.0.parent_sku', 'WIN-POP-1')
                ->where('popularProducts.0.flash_sale', false)
                ->where('popularProducts.1.parent_sku', 'WIN-POP-2'));
    }

    public function test_home_limits_admin_curated_products_to_ten(): void
    {
        CatalogTaxonomy::forgetCache();

        foreach (range(1, 11) as $position) {
            $this->makePromoProduct(
                sku: sprintf('WIN-POPULAR-%02d', $position),
                name: "Popular {$position}",
                homepagePopular: true,
                homepagePopularSort: $position,
            );
        }

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('popularProducts', 10)
                ->where('popularProducts.0.parent_sku', 'WIN-POPULAR-01')
                ->where('popularProducts.9.parent_sku', 'WIN-POPULAR-10'));
    }

    public function test_home_builds_running_promo_from_linked_product(): void
    {
        $product = Product::create([
            'parent_sku' => 'BOU-PROMO-1',
            'name' => 'Boven Jungkit',
            'short_name' => 'Boven Jungkit',
            'category_id' => 1,
            'product_category' => 'BOUVEN',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'BOU-PROMO-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);
        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'stored_url' => 'https://cdn.example/boven-promo.jpg',
            'status' => 'downloaded',
        ]);

        CmsBanner::create([
            'title' => 'Diskon sampai 30%',
            'image_url' => 'https://cdn.example/fallback.jpg',
            'link_url' => '/product/BOU-PROMO-1',
            'sort_order' => 1,
            'published' => true,
        ]);

        CmsBanner::create([
            'title' => 'Promo tidak aktif',
            'image_url' => 'https://cdn.example/inactive.jpg',
            'sort_order' => 2,
            'published' => false,
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Home')
                ->has('promoSlides', 2)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing')
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.layout', 'promo_card')
                ->where('promoSlides.1.eyebrow', 'Promo Diskon')
                ->where('promoSlides.1.headline', "Boven\nJungkit")
                ->where('promoSlides.1.subheadline', 'Harga miring, kualitas terjamin')
                ->where('promoSlides.1.accent', '-30%')
                ->where('promoSlides.1.image', 'https://cdn.example/boven-promo.jpg')
                ->where('promoSlides.1.href', '/product/BOU-PROMO-1'));
    }

    public function test_product_card_uses_real_internal_promotion_attributes(): void
    {
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-PROMO-CARD',
            'name' => 'Jendela Promo',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => true,
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-PROMO-CARD-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $flash = Promotion::create([
            'type' => Promotion::TYPE_FLASH_SALE,
            'name' => 'FS Kartu',
            'status' => Promotion::STATUS_ACTIVE,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'discount_percent' => 20,
        ]);
        PromotionItem::create([
            'promotion_id' => $flash->id,
            'target_type' => 'product',
            'target_id' => (string) $product->id,
        ]);
        app(\App\Services\CampaignService::class)->flushCache();

        foreach ([
            'promo_cod' => 'true',
            'promo_warranty' => 'Garansi 100%',
        ] as $name => $value) {
            ProductAttribute::create([
                'product_id' => $product->id,
                'attribute_name' => $name,
                'attribute_value' => $value,
                'source' => 'internal',
            ]);
        }

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('popularProducts.0.parent_sku', 'WIN-PROMO-CARD')
                ->where('popularProducts.0.min_price', fn ($value) => (float) $value === 800000.0)
                ->where('popularProducts.0.compare_price', fn ($value) => (float) $value === 1000000.0)
                ->where('popularProducts.0.discount_percent', 20)
                ->where('popularProducts.0.flash_sale', true)
                ->where('popularProducts.0.cod_eligible', true)
                ->where('popularProducts.0.warranty_label', 'Garansi 100%'));
    }

    public function test_product_card_uses_current_storefront_event_discount(): void
    {
        config()->set('storefront.product_card_discount_percent', 20);

        $product = Product::create([
            'parent_sku' => 'WIN-EVENT-20',
            'name' => 'Jendela Event Dua Puluh Persen',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => true,
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-EVENT-20-100',
            'price' => 800000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('popularProducts.0.parent_sku', 'WIN-EVENT-20')
                ->where('popularProducts.0.compare_price', fn ($value) => (float) $value === 1000000.0)
                ->where('popularProducts.0.discount_percent', 20));
    }

    public function test_home_shows_campaign_slider_fallback_when_no_promo_is_published(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Home')
                ->has('promoSlides', 1)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing')
                ->where('promoSlides.0.eyebrow', 'PROMO BOVEN JUNGKIT')
                ->where('promoSlides.0.headline', 'Diskon 20%')
                ->where('promoSlides.0.subheadline', 'Hanya Hari Ini !')
                ->where('promoSlides.0.accent', null)
                ->where('promoSlides.0.image', '/images/home/model-casement.png')
                ->where('promoSlides.0.href', '/products/bouven'));
    }

    public function test_home_shows_only_landing_slide_when_no_banner_is_published(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('promoSlides', 1)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing'));
    }

    public function test_manual_banner_slide_uses_linked_product_photo_and_copy(): void
    {
        $bouven = $this->makePromoProduct('BOU-MANUAL-NEW', 'Boven Manual Baru');
        $bouven->update([
            'product_category' => 'BOUVEN',
            'product_model' => 'JUNGKIT',
        ]);

        CmsBanner::create([
            'title' => 'Boven promo',
            'image_url' => 'https://cdn.example/fallback.jpg',
            'link_url' => '/product/BOU-MANUAL-NEW',
            'sort_order' => 1,
            'published' => true,
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('promoSlides', 2)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing')
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.layout', 'promo_card')
                ->where('promoSlides.1.href', '/product/BOU-MANUAL-NEW')
                ->where('promoSlides.1.image', 'https://cdn.example/BOU-MANUAL-NEW.jpg')
                ->where('promoSlides.1.eyebrow', 'Promo')
                ->where('promoSlides.1.headline', "Boven\nJungkit"));
    }

    public function test_home_builds_slides_from_published_banners_only(): void
    {
        foreach (['Banner Satu', 'Banner Dua', 'Banner Tiga'] as $i => $title) {
            CmsBanner::create([
                'title' => $title,
                'image_url' => 'https://cdn.example/fallback-'.$i.'.jpg',
                'link_url' => null,
                'sort_order' => $i + 1,
                'published' => true,
            ]);
        }
        CmsBanner::create([
            'title' => 'Tidak Aktif',
            'image_url' => 'https://cdn.example/draft.jpg',
            'link_url' => null,
            'sort_order' => 99,
            'published' => false,
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Home')
                ->has('promoSlides', 4)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing')
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.layout', 'promo_card')
                ->where('promoSlides.1.headline', 'Banner satu')
                ->where('promoSlides.2.source', 'manual')
                ->where('promoSlides.2.headline', 'Banner dua')
                ->where('promoSlides.3.source', 'manual')
                ->where('promoSlides.3.headline', 'Banner tiga'));
    }

    public function test_manual_slides_follow_banner_sort_order(): void
    {
        $this->makePromoProduct('WIN-MAN-2', 'Jendela Manual 2');
        $this->makePromoProduct('WIN-MAN-1', 'Jendela Manual 1');

        CmsBanner::create([
            'title' => 'Kedua',
            'image_url' => 'https://cdn.example/second.jpg',
            'link_url' => '/product/WIN-MAN-2',
            'sort_order' => 2,
            'published' => true,
        ]);
        CmsBanner::create([
            'title' => 'Pertama',
            'image_url' => 'https://cdn.example/first.jpg',
            'link_url' => '/product/WIN-MAN-1',
            'sort_order' => 1,
            'published' => true,
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('promoSlides', 3)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing')
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.href', '/product/WIN-MAN-1')
                ->where('promoSlides.1.headline', "Jendela\nSliding")
                ->where('promoSlides.2.source', 'manual')
                ->where('promoSlides.2.href', '/product/WIN-MAN-2'));
    }

    public function test_automatic_promos_can_be_disabled_from_admin_settings(): void
    {
        $this->makePromoProduct('WIN-OFF-1', 'Jendela Off', [
            'promo_compare_price' => '1000000',
        ]);

        HomepagePromotionSettings::update(['enabled' => false, 'max_slides' => 3]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('promoSlides', 1)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing'));
    }

    public function test_manual_promos_are_the_only_campaign_slides_when_automatic_mode_is_off(): void
    {
        $this->makePromoProduct('BOU-MANUAL-1', 'Boven Manual', [
            'promo_compare_price' => '1000000',
        ]);

        CmsBanner::create([
            'title' => 'Promo Manual',
            'image_url' => 'https://cdn.example/manual-banner.jpg',
            'link_url' => '/product/BOU-MANUAL-1',
            'sort_order' => 1,
            'published' => true,
        ]);

        HomepagePromotionSettings::update(['enabled' => false, 'max_slides' => 3]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('promoSlides', 2)
                ->where('promoSlides.0.source', 'fallback')
                ->where('promoSlides.0.layout', 'landing')
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.href', '/product/BOU-MANUAL-1'));
    }

    public function test_admin_can_update_auto_promotion_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.banners.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Banners/Index')
                ->where('autoPromotions.enabled', true)
                ->where('autoPromotions.max_slides', 3)
                ->where('autoPromotions.candidate_count', 0)
                ->has('autoPromotions.updateUrl'));

        $this->actingAs($admin)
            ->put(route('admin.banners.auto-promotions.update'), [
                'enabled' => false,
                'max_slides' => 2,
            ])
            ->assertRedirect(route('admin.banners.index'));

        $settings = HomepagePromotionSettings::get();
        $this->assertFalse($settings['enabled']);
        $this->assertSame(2, $settings['max_slides']);

        $page = CmsPage::query()->where('slug', 'beranda')->first();
        $this->assertNotNull($page);
        $this->assertFalse((bool) ($page->content['auto_promotions']['enabled'] ?? true));
    }

    public function test_banner_slides_are_excluded_from_announcement_ticker(): void
    {
        $this->makePromoProduct('WIN-TICKER', 'Jendela Ticker');

        CmsBanner::create([
            'title' => 'Ticker Banner',
            'image_url' => 'https://cdn.example/ticker.jpg',
            'link_url' => '/product/WIN-TICKER',
            'sort_order' => 1,
            'published' => true,
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.href', '/product/WIN-TICKER')
                ->where('announcements', fn ($items) => collect($items)->contains(
                    fn ($item) => ($item['href'] ?? '') === '/product/WIN-TICKER'
                ))
                ->where('announcements', fn ($items) => collect($items)->every(
                    fn ($item) => ($item['href'] ?? '') !== '/products/bouven'
                )));
    }
    public function test_flash_sale_discount_rate_is_preserved_for_higher_price_size_cards(): void
    {
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-SIZE-PROMO',
            'name' => 'Jendela Jungkit Ornamen',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-SIZE-PROMO-60',
            'price' => 835000,
            'stock' => 5,
            'height_cm' => 60,
            'width_cm' => 60,
            'status' => 'active',
        ]);
        $large = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-SIZE-PROMO-130',
            'price' => 1675000,
            'stock' => 5,
            'height_cm' => 130,
            'width_cm' => 60,
            'status' => 'active',
        ]);

        $flash = Promotion::create([
            'type' => Promotion::TYPE_FLASH_SALE,
            'name' => 'FS Ukuran',
            'status' => Promotion::STATUS_ACTIVE,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'discount_percent' => 15,
        ]);
        PromotionItem::create([
            'promotion_id' => $flash->id,
            'target_type' => 'product',
            'target_id' => (string) $product->id,
        ]);
        app(\App\Services\CampaignService::class)->flushCache();

        $product->load(['mainImage', 'media', 'activeVariants', 'attributes']);
        $card = InertiaCatalog::sizeCard($product, $large);

        $this->assertSame(1424000.0, $card['min_price']);
        $this->assertSame(15, $card['discount_percent']);
        $this->assertSame(1675000.0, (float) $card['compare_price']);
        $this->assertTrue($card['flash_sale']);
    }
}
