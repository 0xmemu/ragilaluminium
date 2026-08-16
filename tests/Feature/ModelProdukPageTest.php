<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

class ModelProdukPageTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    public function test_products_hub_renders_model_produk_not_sku_catalog(): void
    {
        $this->createVisibleProduct([
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
                ->missing('popularProducts')
                ->where('models.0.model', 'JUNGKIT')
                ->where('models.0.category', 'WINDOW')
            );
    }

    public function test_products_hub_lists_each_category_model_pair(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-S-1',
            'name' => 'Window Sliding',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $this->createVisibleProduct([
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
                // Design filtering belongs to the SKU catalog, not this
                // model/category-scoped hub.
                ->missing('filterDesigns')
            );
    }

    public function test_products_with_sort_newest_renders_all_products_sku_catalog(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-ALL-1',
            'name' => 'All Products Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products/all?sort=newest')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Semua Produk')
                ->where('isAllProductsListing', true)
                ->where('canonicalUrl', url('/products/all'))
                ->where('robotsDirective', 'noindex,follow')
                ->has('products', 1)
                ->has('popularProducts', 1)
            );
    }

    public function test_products_without_sort_defaults_to_popular(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-DEFAULT-POPULAR-1',
            'name' => 'Default Popular Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Semua Produk')
                ->where('activeSort', 'popular')
                ->where('canonicalUrl', url('/products/all'))
                ->where('robotsDirective', 'index,follow')
            );

        $this->get('/products/windows')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('categoryName', 'Jendela')
                ->where('activeSort', 'popular')
            );
    }

    public function test_products_with_sort_popular_renders_sku_catalog(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-POP-1',
            'name' => 'Popular Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products/all?sort=popular')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('categoryName', 'Paling Banyak Dipesan')
                ->where('canonicalUrl', url('/products/all'))
                ->where('robotsDirective', 'noindex,follow')
                ->has('products')
            );
    }

    public function test_legacy_products_query_redirects_to_unambiguous_listing_url(): void
    {
        $this->get('/products?sort=newest')
            ->assertRedirect('/products/all?sort=newest');
    }

    public function test_model_detail_page_renders_from_card_click_route(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-SWING-1',
            'name' => 'Swing Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelProduk')
                ->where('models.0.detail_href', '/products/jendela/swing')
            );

        $this->get(route('catalog.model', ['category' => 'jendela', 'model' => 'swing']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelDetail')
                ->where('model.model', 'SWING')
                ->where('model.category', 'WINDOW')
                ->where('model.subtitle', null)
                ->has('model.desc')
                ->has('model.highlights', 3)
                ->where('hubHref', '/products')
                ->has('products', 1)
                ->where('products.0.parent_sku', 'WIN-SWING-1')
                ->where('products.0.product_model', 'SWING')
                ->where('products.0.href', '/product/WIN-SWING-1')
                ->has('designRails')
                ->where('designRails.0.value', 'POLOS')
            );
    }

    public function test_model_detail_omits_design_rails_without_products(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-JUNG-ORN-1',
            'name' => 'Jungkit Ornamen Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $this->get(route('catalog.model', ['category' => 'window', 'model' => 'jungkit']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelDetail')
                ->has('designRails', 1)
                ->where('designRails.0.value', 'ORNAMEN')
                ->where('designRails.0.count', 1)
            );
    }

    public function test_products_hub_sorts_fallback_models_by_product_sales(): void
    {
        $sliding = $this->makeHubProduct('WIN-HUB-SLIDE', 'SLIDING');
        $jungkit = $this->makeHubProduct('WIN-HUB-JUNG', 'JUNGKIT');

        // SLIDING lebih laris daripada JUNGKIT — harus di depan walau JUNGKIT
        // lebih dulu di MODEL_ORDER default (membuktikan sort "popular" bekerja).
        $this->addSales($sliding, 8);
        $this->addSales($jungkit, 5);

        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelProduk')
                ->has('models', 2)
                ->where('models.0.model', 'SLIDING')
                ->where('models.1.model', 'JUNGKIT')
            );
    }

    public function test_products_hub_sorts_cms_models_by_product_sales(): void
    {
        $sliding = $this->makeHubProduct('WIN-CMS-SLIDE', 'SLIDING');
        $jungkit = $this->makeHubProduct('WIN-CMS-JUNG', 'JUNGKIT');
        $this->addSales($sliding, 9);
        $this->addSales($jungkit, 2);

        CmsModelProduct::create([
            'name' => 'Jendela Sliding',
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'type' => 'polos',
            'status' => 'active',
            'sort_order' => 1,
        ]);
        CmsModelProduct::create([
            'name' => 'Jendela Jungkit',
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'type' => 'polos',
            'status' => 'active',
            'sort_order' => 2,
        ]);

        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelProduk')
                ->has('models', 2)
                ->where('models.0.model', 'SLIDING')
                ->where('models.1.model', 'JUNGKIT')
            );
    }

    public function test_category_design_page_shows_popular_products_carousel(): void
    {
        $popular = $this->makeHubProduct('WIN-DESIGN-POP', 'JUNGKIT');
        $popular->update(['design_variant' => 'ORNAMEN']);
        $this->addSales($popular, 6);

        $this->get('/products/windows/jungkit/ornamen')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Catalog')
                ->where('isAllProductsListing', false)
                ->has('popularProducts', 1)
            );
    }

    private function makeHubProduct(string $sku, string $model): Product
    {
        return $this->createVisibleProduct([
            'parent_sku' => $sku,
            'name' => $model.' Hub',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function addSales(Product $product, int $qty): void
    {
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'customer_name' => 'Buyer',
            'customer_phone' => '08111111111',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'subtotal_amount' => 100000 * $qty,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000 * $qty,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => 100000,
            'quantity' => $qty,
            'line_subtotal' => 100000 * $qty,
            'line_discount' => 0,
            'line_total' => 100000 * $qty,
        ]);
    }
}
