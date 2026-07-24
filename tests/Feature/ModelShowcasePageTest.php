<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\ProductMedia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

class ModelShowcasePageTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_model_showcase_renders_for_known_model(): void
    {
        Product::create([
            'parent_sku' => 'WIN-KM-1',
            'name' => 'Kaca Mati Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'KACA_MATI',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/model/windows/kaca-mati')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelShow')
                ->where('category', 'WINDOW')
                ->where('model', 'KACA_MATI')
                ->where('catalog_href', '/windows?model=KACA_MATI')
                ->has('benefits', 3)
                ->has('specs')
                ->has('inspirations')
                ->has('pagination')
            );
    }

    public function test_model_showcase_uses_cms_content_when_active(): void
    {
        CmsModelProduct::create([
            'name' => 'Kaca Mati Polos',
            'product_category' => 'WINDOW',
            'product_model' => 'KACA_MATI',
            'image_url' => null,
            'content' => [
                'description' => 'Deskripsi custom dari CMS.',
                'hero_caption' => 'Residence Jakarta',
                'benefits' => [
                    ['icon' => 'sun', 'title' => 'Pencahayaan maksimal'],
                ],
                'specs' => [
                    ['label' => 'Frame', 'value' => 'Aluminium'],
                ],
            ],
            'type' => 'polos',
            'status' => 'active',
            'sort_order' => 1,
        ]);

        $this->get('/model/windows/kaca-mati')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelShow')
                ->where('title', 'Kaca Mati Polos')
                ->where('description', 'Deskripsi custom dari CMS.')
                ->where('hero.caption', 'Residence Jakarta')
                ->where('benefits.0.title', 'Pencahayaan maksimal')
                ->where('specs.0.value', 'Aluminium')
            );
    }

    public function test_model_hub_card_href_points_to_showcase(): void
    {
        Product::create([
            'parent_sku' => 'WIN-J-1',
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
                ->where('models.0.href', '/model/windows/jungkit')
            );
    }

    public function test_model_showcase_lists_installation_inspirations(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-KM-2',
            'name' => 'Kaca Mati Install',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'KACA_MATI',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => false,
            'show_in_catalog' => false,
            'is_installation' => true,
            'visibility' => 'visible',
            'source_url' => 'https://example.com/install.jpg',
            'stored_path' => 'media/install.jpg',
            'stored_url' => '/storage/media/install.jpg',
            'status' => 'downloaded',
        ]);

        $this->get('/model/windows/kaca-mati')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelShow')
                ->has('inspirations', 1)
                ->where('inspirations.0.href', '/hasil-pemasangan/WIN-KM-2')
            );
    }

    public function test_unknown_model_returns_404(): void
    {
        $this->get('/model/windows/tidak-ada')->assertNotFound();
    }
}
