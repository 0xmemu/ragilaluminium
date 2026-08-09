<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\FlashSalePeriodSettings;
use App\Models\Promotion;
use App\Models\PromotionItem;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CartPromoPricingTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_cart_subtotal_uses_sale_price_and_exposes_promo_discount(): void
    {
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-PROMO-1',
            'name' => 'Jendela Promo',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-PROMO-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);
        $flash = Promotion::create([
            'type' => Promotion::TYPE_FLASH_SALE,
            'name' => 'Flash Sale Juni',
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

        // FlashSalePeriodSettings::update() di atas sempat meresolve CampaignService
        // (liveCache kosong saat itu) -> flush agar kampanye baru terbaca.
        app(\App\Services\CampaignService::class)->flushCache();

        $this->withSession([
            'ragil_cart' => [
                'WIN-PROMO-1-V1' => [
                    'line_id' => 'WIN-PROMO-1-V1',
                    'parent_sku' => 'WIN-PROMO-1',
                    'variant_sku' => 'WIN-PROMO-1-V1',
                    'name' => 'Jendela Promo',
                    // Stale list price in session — live resolve must override.
                    'unit_price' => 1000000,
                    'quantity' => 2,
                ],
            ],
        ]);

        $ps = app(\App\Services\PriceService::class);
        $campaigns = app(\App\Services\CampaignService::class);
        $now = now();
        $q = \App\Models\Promotion::query()
            ->where(function ($query) use ($now) {
                $query->where('status', \App\Models\Promotion::STATUS_ACTIVE)
                    ->orWhere(function ($query) use ($now) {
                        $query->where('status', \App\Models\Promotion::STATUS_SCHEDULED)
                            ->where('starts_at', '<=', $now);
                    });
            })
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>', $now);
            });
        $row = \Illuminate\Support\Facades\DB::table('promotions')->first();
        fwrite(STDERR, json_encode([
            'count' => \Illuminate\Support\Facades\DB::table('promotions')->count(),
            'row' => $row,
            'qcount' => $q->count(),
            'now' => (string) $now,
            'live' => $campaigns->liveCampaigns()->pluck('name')->all(),
            'fp' => $campaigns->forProduct($product, $product->activeVariants->first()),
            'priced' => $ps->forVariant($product->activeVariants->first(), $product),
        ])."\n");

        $response = $this->get('/cart');
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Public/Cart')
            ->where('subtotal', 1600000)
            ->where('compare_subtotal', 2000000)
            ->where('discount_total', 400000)
            ->where('items.0.unit_price', 800000)
            ->where('items.0.compare_price', 1000000)
            ->where('items.0.line_discount', 400000)
            ->where('items.0.flash_sale', true)
        );
    }
}
