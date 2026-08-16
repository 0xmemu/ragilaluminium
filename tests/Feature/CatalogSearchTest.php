<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

class CatalogSearchTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    public function test_search_matches_indonesian_model_phrase(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-SL-1',
            'name' => 'Sample Sliding Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->createVisibleProduct([
            'parent_sku' => 'WIN-JK-1',
            'name' => 'Sample Jungkit Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products/all?q='.urlencode('jendela sliding'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-SL-1')
            );
    }

    public function test_category_listing_title_includes_active_model_and_design_filters(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-SL-TITLE-1',
            'name' => 'Sliding Title',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $this->get('/windows')
            ->assertNotFound();

        $this->get('/products/jendela')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Jendela')
            );

        $this->get('/windows?model=SLIDING')
            ->assertNotFound();

        $this->get('/products/jendela/sliding/ornamen')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Jendela Sliding Ornamen')
                ->where('activeModel', 'SLIDING')
                ->where('activeDesign', 'ORNAMEN')
                ->where('robotsDirective', 'index,follow')
            );

        $this->get('/windows?model=SLIDING&design=ORNAMEN')
            ->assertNotFound();

        $this->get('/doors?model=SWING')
            ->assertNotFound();
    }

    public function test_english_category_aliases_redirect_301_to_indonesian_canonical(): void
    {
        // Alias English / non-kanonik → 301 ke slug Indonesia (anti duplicate-content).
        $this->get('/products/windows')
            ->assertRedirect(route('catalog.category', ['category' => 'jendela'], false));
        $this->get('/products/doors')
            ->assertRedirect(route('catalog.category', ['category' => 'pintu'], false));
        $this->get('/products/bouven')
            ->assertRedirect(route('catalog.category', ['category' => 'boven'], false));

        // Route model/desain tetap dipertahankan saat alias kategori di-redirect.
        $this->get('/products/windows/sliding/ornamen')
            ->assertRedirect(route('catalog.design', ['category' => 'jendela', 'model' => 'sliding', 'design' => 'ornamen'], false));

        // Slug kanonik Indonesia tetap 200.
        $this->get('/products/boven')
            ->assertOk();
    }
}

