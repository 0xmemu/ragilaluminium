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
            'product_category' => 'JENDELA',
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
            'product_category' => 'JENDELA',
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
            'product_category' => 'JENDELA',
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
            'product_category' => 'JENDELA',
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
                // Carousel = 10 teratas urutan galeri, jadi produk yang belum
                // dikurasi pun ikut tampil bila masih di dalam 10 besar.
                ->has('popularProducts', 3)
                ->has('nav.public.hamburger_product', 5)
                ->where('nav.public.hamburger_product.0.label', 'Model Produk')
                ->where('nav.public.hamburger_product.1.label', 'Semua Produk')
                ->where('nav.public.hamburger_product.2.label', 'Hasil Pemasangan')
                ->where('nav.public.hamburger_product.3.label', 'Ulasan')
                ->where('nav.public.hamburger_product.4.label', 'Flash Sale')
                ->has('nav.public.hamburger_info', 6)
                ->where('nav.public.hamburger_info.0.label', 'Lacak Pengiriman')
                ->where('nav.public.hamburger_info.5.label', 'Tentang Kami')
                ->has('nav.public.hamburger', 11)
                ->has('nav.public.desktop_main', 5)
                ->where('nav.public.desktop_main.0.label', 'Model Produk')
                ->where('nav.public.desktop_main.4.label', 'Tentang Kami')
                ->has('nav.public.model_menu', 3)
                ->where('nav.public.model_menu.0.label', 'Jendela Aluminium Jungkit')
                // Kartu model di beranda kini bersumber dari baris katalog
                // (wadah dibuat otomatis dari produk sejak 2026-09-28), jadi
                // meta-nya berasal dari desain katalog, bukan peta warisan.
                ->where('modelCards.0.meta', 'Polos')
                ->where('popularProducts.0.parent_sku', 'WIN-POP-1')
                ->where('popularProducts.0.flash_sale', false)
                ->where('popularProducts.1.parent_sku', 'WIN-POP-2')
                // Belum dikurasi -> menyusul setelah baris yang punya posisi.
                ->where('popularProducts.2.parent_sku', 'WIN-NEW-1'));
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
            'product_category' => 'BOVEN',
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'manual')
                ->where('promoSlides.0.layout', 'promo_card')
                ->where('promoSlides.0.eyebrow', 'Promo Diskon')
                ->where('promoSlides.0.headline', "Boven\nJungkit")
                ->where('promoSlides.0.subheadline', 'Harga miring, kualitas terjamin')
                ->where('promoSlides.0.accent', '-30%')
                ->where('promoSlides.0.image', 'https://cdn.example/boven-promo.jpg')
                ->where('promoSlides.0.href', '/product/BOU-PROMO-1')
                ->where('promoSlides.1.source', 'placeholder'));
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
            'product_category' => 'JENDELA',
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
            'product_category' => 'JENDELA',
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'placeholder')
                ->where('promoSlides.0.layout', 'placeholder'));
    }

    public function test_home_shows_only_landing_slide_when_no_banner_is_published(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'placeholder')
                ->where('promoSlides.0.layout', 'placeholder'));
    }

    public function test_manual_banner_slide_uses_linked_product_photo_and_copy(): void
    {
        $bouven = $this->makePromoProduct('BOU-MANUAL-NEW', 'Boven Manual Baru');
        $bouven->update([
            'product_category' => 'BOVEN',
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'manual')
                ->where('promoSlides.0.layout', 'promo_card')
                ->where('promoSlides.0.href', '/product/BOU-MANUAL-NEW')
                ->where('promoSlides.0.image', 'https://cdn.example/BOU-MANUAL-NEW.jpg')
                ->where('promoSlides.0.eyebrow', 'Promo')
                ->where('promoSlides.0.headline', "Boven\nJungkit")
                ->where('promoSlides.1.source', 'placeholder'));
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'manual')
                ->where('promoSlides.0.layout', 'promo_card')
                ->where('promoSlides.0.headline', 'Banner satu')
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.headline', 'Banner dua')
                ->where('promoSlides.2.source', 'manual')
                ->where('promoSlides.2.headline', 'Banner tiga')
                ->where('promoSlides.3.source', 'placeholder'));
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'manual')
                ->where('promoSlides.0.href', '/product/WIN-MAN-1')
                ->where('promoSlides.0.headline', "Jendela\nSliding")
                ->where('promoSlides.1.source', 'manual')
                ->where('promoSlides.1.href', '/product/WIN-MAN-2')
                ->where('promoSlides.2.source', 'placeholder'));
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'placeholder')
                ->where('promoSlides.0.layout', 'placeholder'));
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
                ->has('promoSlides', 10)
                ->where('promoSlides.0.source', 'manual')
                ->where('promoSlides.0.href', '/product/BOU-MANUAL-1')
                ->where('promoSlides.1.source', 'placeholder'));
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
                ->where('promoSlides.0.source', 'manual')
                ->where('promoSlides.0.href', '/product/WIN-TICKER')
                ->where('announcements', fn ($items) => collect($items)->contains(
                    fn ($item) => ($item['href'] ?? '') === '/product/WIN-TICKER'
                ))
                ->where('announcements', fn ($items) => collect($items)->every(
                    fn ($item) => ($item['href'] ?? '') !== '/products/boven'
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
            'product_category' => 'JENDELA',
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

    // ================================================================
    // Halaman admin "Paling Banyak Dipesan" (urutan kurasi carousel)
    // ================================================================

    private function adminUser(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_admin_popular_page_lists_products_without_action_buttons(): void
    {
        $this->makePromoProduct('WIN-LIST-1', 'Jendela Satu');
        $this->makePromoProduct('WIN-LIST-2', 'Jendela Dua');

        $this->actingAs($this->adminUser())
            ->get(route('admin.beranda.popular.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Beranda/Popular')
                ->has('products', 2)
                ->has('products.0', fn ($row) => $row
                    ->has('name')
                    ->has('parent_sku')
                    ->has('category_label')
                    ->has('model_label')
                    ->has('design_label')
                    ->etc())
                ->where('carouselLimit', 10)
                ->has('submitUrl'));
    }

    public function test_saving_popular_order_flags_top_ten_eligible_products(): void
    {
        $products = [];
        foreach (range(1, 12) as $i) {
            $products[] = $this->makePromoProduct(
                sku: sprintf('WIN-RANK-%02d', $i),
                name: "Rank {$i}",
            );
        }

        $ids = array_reverse(array_map(fn (Product $p) => $p->id, $products));

        $this->actingAs($this->adminUser())
            ->put(route('admin.beranda.popular.update'), ['product_ids' => $ids])
            ->assertRedirect(route('admin.beranda.popular.index'));

        $this->assertSame(10, Product::query()->where('homepage_popular', true)->count());
        // Posisi 1-based; 0 disimpan sebagai penanda "belum dikurasi".
        $this->assertSame(1, (int) Product::find($ids[0])->homepage_popular_sort);
        $this->assertTrue((bool) Product::find($ids[0])->homepage_popular);
        $this->assertSame(10, (int) Product::find($ids[9])->homepage_popular_sort);
        $this->assertTrue((bool) Product::find($ids[9])->homepage_popular);
        $this->assertFalse((bool) Product::find($ids[10])->homepage_popular);
        $this->assertSame(11, (int) Product::find($ids[10])->homepage_popular_sort);
    }

    public function test_popular_order_skips_products_that_cannot_air(): void
    {
        $live = $this->makePromoProduct('WIN-OK-1', 'Jendela Aktif');
        $draft = $this->makePromoProduct('WIN-DRAFT-1', 'Jendela Arsip');
        $draft->update(['status' => 'archived']);

        $this->actingAs($this->adminUser())
            ->put(route('admin.beranda.popular.update'), [
                'product_ids' => [$draft->id, $live->id],
            ])
            ->assertRedirect();

        // Produk arsip tetap menyimpan posisi visualnya, tapi tidak ikut tayang;
        // produk aktif mengambil slot carousel walau posisinya di bawah arsip.
        $this->assertFalse((bool) $draft->fresh()->homepage_popular);
        $this->assertTrue((bool) $live->fresh()->homepage_popular);
        $this->assertSame(2, (int) $live->fresh()->homepage_popular_sort);
    }

    public function test_popular_order_is_preserved_on_reload(): void
    {
        $a = $this->makePromoProduct('WIN-KEEP-A', 'Keep A');
        $b = $this->makePromoProduct('WIN-KEEP-B', 'Keep B');
        $c = $this->makePromoProduct('WIN-KEEP-C', 'Keep C');

        $this->actingAs($this->adminUser())
            ->put(route('admin.beranda.popular.update'), [
                'product_ids' => [$c->id, $a->id, $b->id],
            ])
            ->assertRedirect();

        $this->actingAs($this->adminUser())
            ->get(route('admin.beranda.popular.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('products.0.parent_sku', 'WIN-KEEP-C')
                ->where('products.1.parent_sku', 'WIN-KEEP-A')
                ->where('products.2.parent_sku', 'WIN-KEEP-B'));
    }

    public function test_saving_product_form_does_not_clear_popular_curation(): void
    {
        $product = $this->makePromoProduct('WIN-KEEP-FLAG', 'Jendela Kurasi');
        $product->update(['homepage_popular' => true, 'homepage_popular_sort' => 4]);

        $this->actingAs($this->adminUser())
            ->put(route('admin.products.update', $product), [
                'name' => 'Jendela Kurasi',
                'product_category' => 'JENDELA',
                'product_model' => 'SLIDING',
                'design_variant' => 'POLOS',
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.products.index'));

        $fresh = $product->fresh();
        $this->assertTrue((bool) $fresh->homepage_popular);
        $this->assertSame(4, (int) $fresh->homepage_popular_sort);
    }

    public function test_popular_listing_follows_curated_order_only_with_marker(): void
    {
        CatalogTaxonomy::forgetCache();

        $first = $this->makePromoProduct('WIN-CUR-1', 'Kurasi Pertama');
        $second = $this->makePromoProduct('WIN-CUR-2', 'Kurasi Kedua');
        $third = $this->makePromoProduct('WIN-CUR-3', 'Kurasi Ketiga');

        // Kurasi: Ketiga > Pertama > Kedua (urutan sengaja bukan alfabetis/id).
        $this->actingAs($this->adminUser())
            ->put(route('admin.beranda.popular.update'), [
                'product_ids' => [$third->id, $first->id, $second->id],
            ])
            ->assertRedirect();

        // Dengan penanda dari carousel: urutan kurasi admin tampil di depan.
        $this->get(route('catalog.all', ['sort' => 'popular', 'from' => 'paling-banyak-dipesan']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('products.0.parent_sku', 'WIN-CUR-3')
                ->where('products.1.parent_sku', 'WIN-CUR-1')
                ->where('products.2.parent_sku', 'WIN-CUR-2'));

        // Tanpa penanda: murni skor popularitas (semua nol penjualan -> tie-break
        // id menurun), jadi urutannya BEDA dari kurasi [3, 1, 2].
        $this->get(route('catalog.all', ['sort' => 'popular']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('products.0.parent_sku', 'WIN-CUR-3')
                ->where('products.1.parent_sku', 'WIN-CUR-2')
                ->where('products.2.parent_sku', 'WIN-CUR-1'));
    }

    public function test_carousel_matches_top_ten_of_the_popular_gallery(): void
    {
        CatalogTaxonomy::forgetCache();

        // 14 produk supaya pemotongan 10 teratas benar-benar teruji.
        $products = [];
        foreach (range(1, 14) as $i) {
            $products[] = $this->makePromoProduct(
                sku: sprintf('WIN-INV-%02d', $i),
                name: "Inventaris {$i}",
            );
        }

        // Kurasi 3 produk di depan dengan urutan bukan bawaan.
        $curated = [$products[7], $products[2], $products[11]];
        $this->actingAs($this->adminUser())
            ->put(route('admin.beranda.popular.update'), [
                'product_ids' => array_map(fn (Product $p) => $p->id, $curated),
            ])
            ->assertRedirect();

        // Urutan yang dilihat pembeli di halaman daftar produk.
        $gallerySkus = null;
        $this->get(route('catalog.all', ['sort' => 'popular', 'from' => 'paling-banyak-dipesan']))
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) use (&$gallerySkus): void {
                $rows = $page->toArray()['props']['products'];
                $gallerySkus = array_column($rows, 'parent_sku');
            });

        // Carousel beranda harus persis 10 produk teratas dari urutan itu.
        $this->get('/')
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) use ($gallerySkus): void {
                $cards = $page->toArray()['props']['popularProducts'];
                $carouselSkus = array_column($cards, 'parent_sku');

                $this->assertCount(10, $carouselSkus, 'Carousel harus 10 kartu.');
                $this->assertSame(
                    array_slice($gallerySkus, 0, 10),
                    $carouselSkus,
                    'Isi carousel wajib sama dengan 10 produk teratas halaman daftar produk.',
                );
            });

        // Tiga produk kurasi menempati tiga posisi teratas keduanya.
        $this->assertSame(
            array_map(fn (Product $p) => $p->parent_sku, $curated),
            array_slice($gallerySkus, 0, 3),
        );
    }

    public function test_admin_page_exposes_thumbnail_link_and_carousel_since(): void
    {
        CatalogTaxonomy::forgetCache();

        $product = $this->makePromoProduct('WIN-UI-1', 'Kartu UI');

        $this->actingAs($this->adminUser())
            ->put(route('admin.beranda.popular.update'), ['product_ids' => [$product->id]])
            ->assertRedirect();

        $this->actingAs($this->adminUser())
            ->get(route('admin.beranda.popular.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Beranda/Popular')
                ->where('products.0.parent_sku', 'WIN-UI-1')
                ->where('products.0.name', 'Kartu UI')
                ->where('products.0.href', fn ($href) => is_string($href)
                    && str_contains($href, '/admin/kelola/produk/'))
                ->where('products.0.in_window', true)
                ->where('products.0.since', fn ($since) => is_string($since) && strlen($since) === 10));
    }

    public function test_carousel_since_is_stamped_on_entry_and_cleared_on_exit(): void
    {
        CatalogTaxonomy::forgetCache();

        $keep = $this->makePromoProduct('WIN-SINCE-A', 'Tetap Carousel');
        $drop = $this->makePromoProduct('WIN-SINCE-B', 'Keluar Carousel');

        $this->assertNull($keep->fresh()->homepage_popular_since, 'Awalnya belum masuk carousel.');

        $admin = $this->adminUser();
        $this->actingAs($admin)
            ->put(route('admin.beranda.popular.update'), ['product_ids' => [$keep->id, $drop->id]])
            ->assertRedirect();

        $this->assertNotNull($keep->fresh()->homepage_popular_since);
        $this->assertNotNull($drop->fresh()->homepage_popular_since);
        $stamped = $keep->fresh()->homepage_popular_since;

        // Simpan ulang dengan posisi tetap: tanggal masuk tidak boleh bergeser,
        // supaya jendela "sebelum vs sesudah" tidak ikut bergerak.
        $this->travel(2)->hours();
        $this->actingAs($admin)
            ->put(route('admin.beranda.popular.update'), ['product_ids' => [$keep->id, $drop->id]])
            ->assertRedirect();

        $this->assertTrue(
            $stamped->equalTo($keep->fresh()->homepage_popular_since),
            'Tanggal masuk carousel harus dipertahankan selama produk tetap di carousel.',
        );

        // Pindahkan produk kedua ke luar 10 teratas (isi 12 slot di atasnya).
        $fillers = [];
        foreach (range(1, 12) as $i) {
            $fillers[] = $this->makePromoProduct(sprintf('WIN-FILL-%02d', $i), "Pengisi {$i}")->id;
        }

        $this->actingAs($admin)
            ->put(route('admin.beranda.popular.update'), [
                'product_ids' => array_merge($fillers, [$drop->id]),
            ])
            ->assertRedirect();

        $this->assertFalse((bool) $drop->fresh()->homepage_popular, 'Keluar dari 10 teratas.');
        $this->assertNull($drop->fresh()->homepage_popular_since, 'Timestamp dibersihkan saat keluar carousel.');
    }

    public function test_engagement_columns_only_appear_for_carousel_rows(): void
    {
        CatalogTaxonomy::forgetCache();

        ProductMedia::query()->delete();

        $inside = $this->makePromoProduct('WIN-ENG-IN', 'Di Carousel');
        $outside = $this->makePromoProduct('WIN-ENG-OUT', 'Di Luar Carousel');

        // 12 pengisi supaya produk 'outside' berada di luar 10 teratas.
        $fillers = [];
        foreach (range(1, 12) as $i) {
            $fillers[] = $this->makePromoProduct(sprintf('WIN-ENGF-%02d', $i), "Isi {$i}")->id;
        }

        $admin = $this->adminUser();
        $this->actingAs($admin)
            ->put(route('admin.beranda.popular.update'), [
                'product_ids' => array_merge([$inside->id], $fillers, [$outside->id]),
            ])
            ->assertRedirect();

        // Anggap produk sudah 3 hari di carousel supaya ada rentang pembanding.
        $inside->fresh()->forceFill(['homepage_popular_since' => now()->subDays(3)])->save();

        $this->actingAs($admin)
            ->get(route('admin.beranda.popular.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('products.0.in_window', true)
                // Baris carousel: kolom engagement terisi angka (0 pun sah).
                ->where('products.0.views_before', fn ($v) => is_int($v))
                ->where('products.0.views_after', fn ($v) => is_int($v))
                ->where('products.0.clicks_before', fn ($v) => is_int($v))
                ->where('products.0.clicks_after', fn ($v) => is_int($v))
                // Baris terakhir di luar carousel: kolom engagement kosong.
                ->where('products.13.in_window', false)
                ->where('products.13.views_after', null)
                ->where('products.13.clicks_after', null));
    }
}
