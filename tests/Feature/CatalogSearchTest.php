<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CatalogSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_matches_indonesian_model_phrase(): void
    {
        Product::create([
            'parent_sku' => 'WIN-SL-1',
            'name' => 'Sample Sliding Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        Product::create([
            'parent_sku' => 'WIN-JK-1',
            'name' => 'Sample Jungkit Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products?q='.urlencode('jendela sliding'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-SL-1')
            );
    }

    public function test_category_listing_title_includes_active_model_and_design_filters(): void
    {
        Product::create([
            'parent_sku' => 'WIN-SL-TITLE-1',
            'name' => 'Sliding Title',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $this->get('/windows')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Jendela')
            );

        $this->get('/windows?model=SLIDING')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Jendela Sliding')
                ->where('activeModel', 'SLIDING')
            );

        $this->get('/windows?model=SLIDING&design=ORNAMEN')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Jendela Sliding Ornamen')
            );

        $this->get('/doors?model=SWING')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Pintu Swing')
            );
    }
}
