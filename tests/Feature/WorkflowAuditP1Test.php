<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Services\CartService;
use App\Support\FlashSalePeriodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WorkflowAuditP1Test extends TestCase
{
    use RefreshDatabase;

    public function test_flash_sale_lives_on_dedicated_page_not_home_carousel(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-FLASH-1',
            'name' => 'Jendela Flash',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-FLASH-1-V1',
            'price' => 500000,
            'stock' => 3,
            'status' => 'active',
        ]);
        ProductAttribute::create([
            'product_id' => $product->id,
            'attribute_name' => 'promo_flash_sale',
            'attribute_value' => 'true',
        ]);
        FlashSalePeriodSettings::update([
            'enabled' => true,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDay()->toIso8601String(),
        ]);

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Home')
                ->missing('flashSaleProducts'));

        $this->get(route('catalog.flash-sale'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Flash Sale')
                ->where('listingMode', 'flash')
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-FLASH-1')
                ->has('filterModels'));

        $this->get(route('catalog.flash-sale', ['model' => 'JUNGKIT']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('listingMode', 'flash')
                ->where('activeModel', 'JUNGKIT')
                ->has('products', 1));

        $this->get(route('catalog.flash-sale', ['model' => 'SWING']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeModel', 'SWING')
                ->has('products', 0));

        $this->get(route('catalog.promo'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('listingMode', 'promo')
                ->has('flashSaleSpotlight', 1)
                ->where('flashSaleSpotlight.0.parent_sku', 'WIN-FLASH-1'));
    }

    public function test_cart_quantity_cannot_exceed_variant_stock(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-STK-1',
            'name' => 'Jendela Stok',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-STK-1-V1',
            'price' => 250000,
            'stock' => 2,
            'status' => 'active',
        ]);

        // Tetap di halaman produk (bukan ke keranjang) supaya animasi "produk terbang" terlihat.
        $this->from('/product/WIN-STK-1')
            ->post(route('cart.add'), [
                'parent_sku' => 'WIN-STK-1',
                'variant_sku' => 'WIN-STK-1-V1',
                'quantity' => 5,
            ])
            ->assertRedirect('/product/WIN-STK-1');

        $cart = app(CartService::class)->get();
        $this->assertSame(2, (int) $cart['WIN-STK-1-V1']['quantity']);
        $this->assertSame(2, (int) $cart['WIN-STK-1-V1']['stock']);

        $this->withHeaders([
            'Accept' => 'application/json',
            'X-Requested-With' => 'XMLHttpRequest',
        ])->post(route('cart.update'), [
            'line_id' => 'WIN-STK-1-V1',
            'quantity' => 9,
        ])->assertOk()->assertJson([
            'line_id' => 'WIN-STK-1-V1',
            'quantity' => 2,
            'stock' => 2,
        ]);

        $cart = app(CartService::class)->get();
        $this->assertSame(2, (int) $cart['WIN-STK-1-V1']['quantity']);
    }
}
