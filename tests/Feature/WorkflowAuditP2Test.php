<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WorkflowAuditP2Test extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-'.uniqid(),
            'customer_name' => 'Buyer',
            'customer_phone' => '08111111111',
            'shipping_address_line1' => 'Jl. A',
            'shipping_city' => 'Banjarnegara',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '53473',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'transfer',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
        ], $overrides));
    }

    public function test_admin_nav_exposes_orphan_ops_routes(): void
    {
        $nav = config('admin-sitemap.navigation');
        $coreRoutes = collect($nav['core']['items'])->pluck('route')->all();
        $komunikasiRoutes = collect($nav['pelanggan_komunikasi']['items'])->pluck('route')->all();
        $productRoutes = collect($nav['produk']['items'])->pluck('route')->all();
        $accountRoutes = collect($nav['akun_sistem']['items'])->pluck('route')->all();

        $this->assertContains('admin.payments.index', $coreRoutes);
        $this->assertContains('admin.shipping.index', $coreRoutes);
        $this->assertContains('admin.analytics.store-performance', $coreRoutes);
        $this->assertContains('admin.imports.index', $productRoutes);
        $this->assertNotContains('admin.analytics.import-performance', $productRoutes); // Fase 13: Import Performance hidup di halaman Import, bukan nav terpisah.
        // Menu WhatsApp terpusat di dashboard (active mencakup messages.*, connection, pairing).
        $this->assertContains('admin.whatsapp.dashboard', $komunikasiRoutes);
        $this->assertContains('admin.activity-logs.index', $accountRoutes);
    }

    public function test_orders_index_filters_payment_shipping_and_date(): void
    {
        $admin = $this->admin();

        $paid = $this->makeOrder([
            'order_number' => 'ORD-PAID-1',
            'customer_name' => 'Paid Buyer',
            'payment_status' => 'paid',
        ]);
        $paid->forceFill(['created_at' => now()->subDays(2), 'updated_at' => now()->subDays(2)])->save();

        $unpaid = $this->makeOrder([
            'order_number' => 'ORD-UNPAID-1',
            'customer_name' => 'Unpaid Buyer',
            'customer_phone' => '08222222222',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
        ]);
        $unpaid->forceFill(['created_at' => now(), 'updated_at' => now()])->save();

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['payment_status' => 'paid']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Index')
                ->where('activePaymentStatus', 'paid')
                ->has('orders', 1)
                ->where('orders.0.order_number', 'ORD-PAID-1'));

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['date_preset' => 'today']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Index')
                ->where('activeDatePreset', 'today')
                ->has('orders', 1)
                ->where('orders.0.order_number', 'ORD-UNPAID-1'));
    }

    public function test_orders_status_filter_exposes_count_and_value_summary(): void
    {
        $admin = $this->admin();

        $this->makeOrder([
            'order_number' => 'ORD-SHIPPED-1',
            'order_status' => 'shipped',
            'total_amount' => 125000,
        ]);
        $this->makeOrder([
            'order_number' => 'ORD-SHIPPED-2',
            'order_status' => 'shipped',
            'total_amount' => 875000,
        ]);
        $this->makeOrder([
            'order_number' => 'ORD-PROCESSING-1',
            'order_status' => 'processing',
            'total_amount' => 500000,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'shipped']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Index')
                ->where('activeStatus', 'shipped')
                ->where('summary.count', 2)
                ->where('summary.total_value', 1000000)
                ->has('orders', 2));
    }

    public function test_media_hub_rows_include_operational_actions(): void
    {
        $admin = $this->admin();

        $product = Product::create([
            'parent_sku' => 'WIN-MED-1',
            'name' => 'Media Product',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'source_url' => 'https://cdn.example.com/a.jpg',
            'status' => 'downloaded',
            'visibility' => 'visible',
            'is_main_image' => false,
            'position' => 1,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.media.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/Index')
                ->has('rows', 1)
                ->has('rows.0.actions')
                ->where('rows.0.actions.0.label', 'Kelola'));
    }
}
