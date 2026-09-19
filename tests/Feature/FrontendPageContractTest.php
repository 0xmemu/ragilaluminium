<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FrontendPageContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_search_path_redirects_to_catalog_with_query(): void
    {
        $this->get('/search?q=jendela')
            ->assertRedirect(route('catalog.index', ['q' => 'jendela'], absolute: false));
    }

    public function test_legacy_ulasan_redirects_to_web_reviews(): void
    {
        $this->get('/ulasan')
            ->assertRedirect(route('reviews.website', absolute: false));

        // Query string lama tetap diteruskan ke slug baru.
        $this->get('/ulasan?sort=oldest')
            ->assertRedirect(route('reviews.website', absolute: false).'?sort=oldest');
    }

    /**
     * /checkout hanya boleh dirender saat ada produk yang siap di-checkout.
     * Dengan keranjang kosong halaman ini mengalihkan ke keranjang (bukan 200).
     */
    public function test_checkout_requires_a_non_empty_cart(): void
    {
        $this->get(route('checkout.index'))
            ->assertRedirect(route('cart.index'));
    }

    public function test_public_entry_pages_render_the_contracted_inertia_components(): void
    {
        $routes = [
            ['home', 'Public/Home'],
            ['catalog.index', 'Public/ModelProduk'],
            ['catalog.category', 'Public/Catalog', ['category' => 'jendela']],
            ['reviews.website', 'Public/Reviews'],
            ['reviews.screenshots', 'Public/Reviews'],
            ['cart.index', 'Public/Cart'],
            ['order.status', 'Public/OrderStatus'],
            ['cara-pemesanan', 'Public/HowToOrder'],
            ['faq', 'Public/Faq'],
            ['masalah-dan-solusi', 'Public/MasalahSolusi'],
            ['about', 'Public/About'],
            ['terms', 'Public/CmsPage'],
            ['privacy', 'Public/CmsPage'],
            ['login', 'Auth/Login'],
        ];

        foreach ($routes as $entry) {
            [$routeName, $component, $parameters] = array_pad($entry, 3, []);

            $this->get(route($routeName, $parameters))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page->component($component));
        }
    }

    public function test_admin_routes_are_protected_from_guests(): void
    {
        $this->get(route('admin.dashboard'))->assertRedirect(route('login'));
        $this->get(route('admin.products.index'))->assertRedirect(route('login'));
        $this->get(route('admin.settings.index'))->assertRedirect(route('login'));
    }

    public function test_active_admin_can_render_every_admin_console_entry_page(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->actingAs($admin);

        $routes = [
            ['admin.dashboard', 'Admin/Dashboard'],
            ['admin.products.index', 'Admin/Products/Index'],
            ['admin.imports.index', 'Admin/Imports/Index'],
            ['admin.orders.index', 'Admin/Orders/Index'],
            ['admin.payments.index', 'Admin/Payments/Index'],
            ['admin.shipping.index', 'Admin/Shipping/Index'],
            ['admin.whatsapp.templates.index', 'Admin/WhatsApp/Index'],
            ['admin.analytics.store-performance', 'Admin/Analytics/StorePerformance'],
            ['admin.activity-logs.index', 'Admin/ActivityLogs/Index'],
            ['admin.beranda.index', 'Admin/Beranda/Index'],
            ['admin.model-products.index', 'Admin/ModelProducts/Index'],
            ['admin.cara-pemesanan.edit', 'Admin/CaraPemesanan/Edit'],
            ['admin.faq.index', 'Admin/Faq/Index'],
            ['admin.masalah-solusi.index', 'Admin/MasalahSolusi/Index'],
            ['admin.tentang-kami.edit', 'Admin/TentangKami/Edit'],
            ['admin.storefront-platforms.edit', 'Admin/StorefrontPlatforms/Edit'],
            ['admin.ketentuan-layanan.edit', 'Admin/CmsDocument/Edit'],
            ['admin.kebijakan-privasi.edit', 'Admin/CmsDocument/Edit'],
            ['admin.pages.index', 'Admin/ResourceIndex'],
            ['admin.banners.index', 'Admin/Banners/Index'],
            ['admin.vouchers.index', 'Admin/Vouchers/Index'],
            ['admin.cod-settings.edit', 'Admin/CodSettings/Edit'],
            ['admin.shipping-subsidy.edit', 'Admin/ShippingSubsidy/Edit'],
            ['admin.customers.index', 'Admin/Customers/Index'],
            ['admin.testimonials.index', 'Admin/Testimonials/Index'],
            ['admin.users.index', 'Admin/Users/Index'],
            ['admin.profile.edit', 'Admin/Profile/Edit'],
            ['admin.settings.index', 'Admin/SystemHealth'],
            ['admin.products.create', 'Admin/ProductForm'],
            ['admin.imports.create', 'Admin/ImportCreate'],
            ['admin.pages.create', 'Admin/CmsPageForm'],
            ['admin.testimonials.create', 'Admin/Testimonials/Form'],
            ['admin.users.create', 'Admin/Users/Form'],
        ];

        foreach ($routes as $entry) {
            [$routeName, $component, $parameters] = array_pad($entry, 3, []);

            $this->get(route($routeName, $parameters))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page->component($component));
        }
    }

    public function test_product_admin_subpages_render_their_specific_components(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = Product::create([
            'parent_sku' => 'WIN-UI-001',
            'name' => 'Jendela Uji UI',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-UI-001-A',
            'price' => 1250000,
            'stock' => 3,
            'status' => 'active',
        ]);

        $this->actingAs($admin);

        $this->get(route('admin.products.show', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Products/Show'));
        // Penggabungan e2e: index varian dialihkan ke tab Varian di halaman edit.
        $this->get(route('admin.products.variants.index', $product))
            ->assertRedirect(route('admin.products.edit', ['product' => $product, 'tab' => 'varian']));
        $this->get(route('admin.variants.edit', $variant))
            ->assertRedirect(route('admin.products.edit', ['product' => $product, 'tab' => 'varian']));
        $this->get(route('admin.products.attributes.index', $product))
            ->assertRedirect(route('admin.products.edit', ['product' => $product, 'tab' => 'spesifikasi']));
        $this->get(route('admin.products.media.byProduct', $product))
            ->assertRedirect(route('admin.products.edit', ['product' => $product, 'tab' => 'media']));
    }

    public function test_every_controller_inertia_component_has_a_typescript_page(): void
    {
        $components = collect(File::allFiles(app_path('Http/Controllers')))
            ->flatMap(function ($file) {
                preg_match_all(
                    "/Inertia::render\\(\\s*['\"]([^'\"]+)['\"]/",
                    File::get($file->getPathname()),
                    $matches
                );

                return $matches[1] ?? [];
            })
            ->unique()
            ->values();

        $this->assertNotEmpty($components);

        foreach ($components as $component) {
            $this->assertFileExists(
                resource_path("js/pages/{$component}.tsx"),
                "Missing Inertia page component: {$component}"
            );
        }
    }
}
