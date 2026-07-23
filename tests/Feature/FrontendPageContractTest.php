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

    public function test_public_entry_pages_render_the_contracted_inertia_components(): void
    {
        $routes = [
            ['home', 'Public/Home'],
            ['catalog.index', 'Public/ModelProduk'],
            ['catalog.windows', 'Public/Catalog'],
            ['reviews', 'Public/Reviews'],
            ['cart.index', 'Public/Cart'],
            ['checkout.index', 'Public/Checkout'],
            ['order.status', 'Public/OrderStatus'],
            ['cara-pemesanan', 'Public/HowToOrder'],
            ['faq', 'Public/Faq'],
            ['masalah-dan-solusi', 'Public/MasalahSolusi'],
            ['about', 'Public/CmsPage'],
            ['terms', 'Public/CmsPage'],
            ['privacy', 'Public/CmsPage'],
            ['login', 'Auth/Login'],
        ];

        foreach ($routes as [$routeName, $component]) {
            $this->get(route($routeName))
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
            ['admin.imports.index', 'Admin/ResourceIndex'],
            ['admin.orders.index', 'Admin/Orders/Index'],
            ['admin.payments.index', 'Admin/ResourceIndex'],
            ['admin.shipping.index', 'Admin/ResourceIndex'],
            ['admin.whatsapp.templates.index', 'Admin/WhatsApp/Index'],
            ['admin.whatsapp.messages.index', 'Admin/ResourceIndex'],
            ['admin.analytics.store-performance', 'Admin/Analytics/StorePerformance'],
            ['admin.analytics.import-performance', 'Admin/ResourceShow'],
            ['admin.activity-logs.index', 'Admin/ActivityLogs/Index'],
            ['admin.beranda.index', 'Admin/Beranda/Index'],
            ['admin.model-products.index', 'Admin/ModelProducts/Index'],
            ['admin.cara-pemesanan.edit', 'Admin/CaraPemesanan/Edit'],
            ['admin.faq.index', 'Admin/Faq/Index'],
            ['admin.masalah-solusi.index', 'Admin/MasalahSolusi/Index'],
            ['admin.tentang-kami.edit', 'Admin/CmsDocument/Edit'],
            ['admin.storefront-platforms.edit', 'Admin/StorefrontPlatforms/Edit'],
            ['admin.ketentuan-layanan.edit', 'Admin/CmsDocument/Edit'],
            ['admin.kebijakan-privasi.edit', 'Admin/CmsDocument/Edit'],
            ['admin.apa-kata-pelanggan.index', 'Admin/Testimonials/Index'],
            ['admin.hasil-pemasangan.index', 'Admin/Testimonials/Index'],
            ['admin.pages.index', 'Admin/ResourceIndex'],
            ['admin.banners.index', 'Admin/Banners/Index'],
            ['admin.flash-sale.index', 'Admin/FlashSale/Index'],
            ['admin.vouchers.index', 'Admin/Vouchers/Index'],
            ['admin.cod-settings.edit', 'Admin/CodSettings/Edit'],
            ['admin.shipping-subsidy.edit', 'Admin/ShippingSubsidy/Edit'],
            ['admin.customers.index', 'Admin/Customers/Index'],
            ['admin.testimonials.index', 'Admin/Testimonials/Index'],
            ['admin.users.index', 'Admin/Users/Index'],
            ['admin.profile.edit', 'Admin/Profile/Edit'],
            ['admin.settings.index', 'Admin/ResourceShow'],
            ['admin.products.create', 'Admin/ProductForm'],
            ['admin.imports.create', 'Admin/ImportCreate'],
            ['admin.pages.create', 'Admin/CmsPageForm'],
            ['admin.testimonials.create', 'Admin/Testimonials/Form'],
            ['admin.users.create', 'Admin/Users/Form'],
        ];

        foreach ($routes as [$routeName, $component]) {
            $this->get(route($routeName))
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
        $this->get(route('admin.products.variants.index', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Variants'));
        $this->get(route('admin.variants.edit', $variant))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/VariantEdit'));
        $this->get(route('admin.products.attributes.index', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Attributes'));
        $this->get(route('admin.products.media.byProduct', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Products/Media'));
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
