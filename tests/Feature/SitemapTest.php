<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SitemapTest extends TestCase
{
    use RefreshDatabase;

    public function test_sitemap_contains_public_hubs_and_active_products_only(): void
    {
        $active = Product::create([
            'parent_sku' => 'ACTIVE-SKU',
            'name' => 'Jendela Jungkit Polos 50x70',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $active->id,
            'variant_sku' => 'ACTIVE-SKU-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);
        Product::create([
            'parent_sku' => 'ARCHIVED-SKU',
            'name' => 'Jendela Jungkit Polos 60x80',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'archived',
        ]);

        $response = $this->get('/sitemap.xml');

        $response->assertOk()
            ->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
            ->assertSee(route('catalog.flash-sale'), false)
            ->assertSee(route('catalog.category', ['category' => 'jendela']), false)
            ->assertSee(route('catalog.model', ['category' => 'jendela', 'model' => 'jungkit']), false)
            ->assertSee(route('catalog.design', ['category' => 'jendela', 'model' => 'jungkit', 'design' => 'polos']), false)
            ->assertDontSee('/products/windows', false)
            ->assertDontSee('/windows', false)
            ->assertSee(route('product.show', $active->parent_sku), false)
            ->assertDontSee('ARCHIVED-SKU');
    }
}
