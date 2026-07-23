<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Support\FlashSalePeriodSettings;
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
            'price' => 800000,
            'stock' => 5,
            'status' => 'active',
        ]);
        ProductAttribute::create([
            'product_id' => $product->id,
            'attribute_name' => 'promo_compare_price',
            'attribute_value' => '1000000',
        ]);
        ProductAttribute::create([
            'product_id' => $product->id,
            'attribute_name' => 'promo_flash_sale',
            'attribute_value' => 'true',
        ]);

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
