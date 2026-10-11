<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Models\ProductVariant;
use App\Services\CampaignService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

/**
 * Kontrak halaman Promo (1 Okt 2026): "semua diskon selain Flash Sale".
 *
 * Promo memuat kampanye diskon reguler (toko) dan produk yang harga
 * pembandingnya diisi manual, sedangkan produk Flash Sale dikeluarkan karena
 * pengunjung yang mencari Flash Sale sudah punya halaman sendiri (/flash-sale)
 * dan pintunya di drawer.
 */
class PromoListingTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function makeProduct(string $sku, string $name): Product
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => $name,
            'short_name' => $name,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }

    private function makeCampaign(string $type, string $name, array $products): void
    {
        $campaign = Promotion::create([
            'type' => $type,
            'name' => $name,
            'status' => Promotion::STATUS_ACTIVE,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'discount_percent' => 20,
        ]);

        foreach ($products as $product) {
            PromotionItem::create([
                'promotion_id' => $campaign->id,
                'target_type' => 'product',
                'target_id' => (string) $product->id,
            ]);
        }

        app(CampaignService::class)->flushCache();
    }

    /** @return list<string> */
    private function skus($page, string $url, string $key = 'products'): array
    {
        $skus = null;
        $this->get($url)
            ->assertOk()
            ->assertInertia(function (AssertableInertia $p) use (&$skus, $key): void {
                $skus = array_column($p->toArray()['props'][$key] ?? [], 'parent_sku');
            });

        return $skus ?? [];
    }

    public function test_halaman_promo_memuat_diskon_reguler_dan_menyingkirkan_flash_sale(): void
    {
        $reguler = $this->makeProduct('WIN-PROMO-REG', 'Diskon Reguler');
        $flash = $this->makeProduct('WIN-PROMO-FS', 'Diskon Flash');
        $polos = $this->makeProduct('WIN-PROMO-POLOS', 'Tanpa Diskon');

        $this->makeCampaign(Promotion::TYPE_STORE, 'Diskon Reguler', [$reguler]);
        $this->makeCampaign(Promotion::TYPE_FLASH_SALE, 'Flash Sale', [$flash]);

        // Promo memuat yang berdiskon reguler, menyingkirkan Flash Sale dan yang
        // tidak berdiskon sama sekali.
        $promo = $this->skus(null, route('catalog.promo'));
        $this->assertSame(['WIN-PROMO-REG'], $promo, 'Promo harus memuat diskon reguler saja.');

        // Flash Sale tetap di halamannya sendiri.
        $flashSkus = $this->skus(null, route('catalog.flash-sale'));
        $this->assertSame(['WIN-PROMO-FS'], $flashSkus, 'Flash Sale harus tetap di /flash-sale.');
    }

    public function test_drawer_memuat_pintu_promo(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('nav.public.hamburger_product.5.label', 'Promo')
                ->has('nav.public.hamburger_product', 6)
                // Promo sengaja tidak masuk nav utama desktop.
                ->has('nav.public.desktop_main', 5));
    }
}
