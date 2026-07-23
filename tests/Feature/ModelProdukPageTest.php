<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

class ModelProdukPageTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_products_hub_renders_model_produk_not_sku_catalog(): void
    {
        Product::create([
            'parent_sku' => 'WIN-MOD-1',
            'name' => 'Jungkit Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelProduk')
                ->has('models', 1)
                ->where('models.0.model', 'JUNGKIT')
                ->where('models.0.category', 'WINDOW')
            );
    }

    public function test_products_hub_lists_each_category_model_pair(): void
    {
        Product::create([
            'parent_sku' => 'WIN-S-1',
            'name' => 'Window Sliding',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        Product::create([
            'parent_sku' => 'DOOR-S-1',
            'name' => 'Door Sliding',
            'category_id' => 1,
            'product_category' => 'DOOR',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelProduk')
                ->has('models', 2)
                ->where('models.0.category', 'WINDOW')
                ->where('models.0.model', 'SLIDING')
                ->where('models.1.category', 'DOOR')
                ->where('models.1.model', 'SLIDING')
                ->has('filterDesigns', 2)
            );
    }

    public function test_products_with_sort_newest_renders_all_products_sku_catalog(): void
    {
        Product::create([
            'parent_sku' => 'WIN-ALL-1',
            'name' => 'All Products Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products?sort=newest')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Semua Produk')
                ->where('isAllProductsListing', true)
                ->has('products', 1)
            );
    }

    public function test_products_with_sort_popular_renders_sku_catalog(): void
    {
        Product::create([
            'parent_sku' => 'WIN-POP-1',
            'name' => 'Popular Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products?sort=popular')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Paling Banyak Dipesan')
                ->has('products')
            );
    }
}
