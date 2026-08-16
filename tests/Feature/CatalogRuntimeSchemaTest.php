<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

class CatalogRuntimeSchemaTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    public function test_legacy_catalog_routes_and_search_are_http_safe(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-RUNTIME-1',
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
        ]);
        $this->createVisibleProduct([
            'parent_sku' => 'DOOR-RUNTIME-1',
            'product_category' => 'DOOR',
            'product_model' => 'SLIDING',
        ]);
        $this->createVisibleProduct([
            'parent_sku' => 'BOUV-RUNTIME-1',
            'product_category' => 'BOUVEN',
            'product_model' => 'SLIDING',
        ]);

        foreach (['/products/all', '/products/jendela', '/products/pintu', '/products/boven'] as $uri) {
            $this->get($uri)
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page->component('Public/Catalog'));
        }

        $this->get('/search?q=sliding')
            ->assertRedirect('/products?q=sliding');

        $this->get('/products?q=sliding')
            ->assertRedirect('/products/all?q=sliding');
    }

    public function test_catalog_and_pdp_fallback_when_popularity_migration_is_not_present(): void
    {
        $product = $this->createVisibleProduct([
            'parent_sku' => 'WIN-RUNTIME-FALLBACK',
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
        ]);

        Schema::shouldReceive('hasColumn')
            ->with('products', 'popularity_seed')
            ->andReturn(false);
        Schema::shouldReceive('hasTable')
            ->with('product_popularity_boosts')
            ->andReturn(false);

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->has('products', 1)
            );

        $this->get('/product/'.$product->parent_sku)
            ->assertOk();
    }
}
