<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ImportJob;
use App\Models\MediaAsset;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-DASH-'.uniqid(),
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '08123456789',
            'shipping_address_line1' => 'Jl. Merdeka 1',
            'shipping_city' => 'Jakarta Selatan',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12190',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'transfer',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
        ], $overrides));
    }

    public function test_dashboard_exposes_figma_feature_blocks(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
            'name' => 'Mas Putra',
        ]);

        $overdue = $this->makeOrder([
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'total_amount' => 1_500_000,
        ]);
        $overdue->forceFill(['updated_at' => now()->subDays(2)])->save();

        $this->makeOrder([
            'order_status' => 'processing',
            'total_amount' => 2_000_000,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->where('greetingName', 'Mas Putra')
                ->has('generatedAt')
                ->has('omzet.revenue')
                ->has('omzet.orders_delta')
                ->has('omzet.units_delta')
                ->has('omzet.sparkline')
                ->has('performa.metrics', 4)
                ->where('performa.trend.granularity', 'hour')
                ->has('performa.trend.series')
                ->where('performa.period', 'today')
                ->has('performa.period_options')
                ->has('integrationReadiness', 4)
                ->where('integrationReadiness.0.verified', false)
                ->where('integrationReadiness.0.status_label', 'Konfigurasi ada, live check belum dilakukan')
                ->has('statusOrder', 5)
                ->has('attention')
                ->has('quickActions', 4)
                ->where('quickActions.0.label', 'Tambah Produk')
                ->where('quickActions.0.href', route('admin.products.create'))
                ->where('quickActions.1.label', 'Mulai Import')
                ->where('quickActions.1.href', route('admin.imports.create'))
                ->where('quickActions.2.label', 'Lihat Pending Payment')
                ->where('quickActions.2.href', route('admin.orders.index', ['order_status' => 'pending_payment']))
                ->where('quickActions.3.label', 'Kelola Media')
                ->where('quickActions.3.href', route('admin.media.index'))
                ->has('recentOrders')
            );
    }

    public function test_dashboard_performa_period_filter_is_honoured(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard', ['performa_period' => 'last_7']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->where('performa.period', 'last_7')
                ->where('performa.trend.granularity', 'day')
                ->has('performa.trend.series', 7)
            );
    }

    public function test_status_order_cards_link_to_filtered_orders(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->makeOrder(['order_status' => 'shipped']);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('statusOrder.2.key', 'shipped')
                ->where('statusOrder.2.total', 1)
                ->where('statusOrder.2.total_value', 1_000_000)
                ->where('statusOrder.2.href', route('admin.orders.index', ['order_status' => 'shipped']))
            );
    }

    public function test_pending_attention_uses_pending_age_not_last_edit_time(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $oldPending = $this->makeOrder([
            'order_number' => 'RA-DASH-OLD-PENDING-'.uniqid(),
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
        ]);
        $oldPending->forceFill([
            'created_at' => now()->subDays(2),
            'updated_at' => now(),
        ])->save();

        $newPending = $this->makeOrder([
            'order_number' => 'RA-DASH-NEW-PENDING-'.uniqid(),
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('attention.0.key', 'confirm_overdue')
                ->where('attention.0.count', 1)
                ->where('attention.0.href', route('admin.orders.index', ['order_status' => 'pending_payment']))
                ->where('statusOrder.0.total', 2)
            );

        $this->assertNotNull($newPending->fresh());
    }

    public function test_recent_orders_expose_real_operational_actions_and_cancelled_status(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $cancelled = $this->makeOrder([
            'order_number' => 'RA-DASH-CANCELLED-RECENT-'.uniqid(),
            'order_status' => 'cancelled',
            'payment_status' => 'refunded',
            'shipping_status' => 'cancelled',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('recentOrders.0.id', $cancelled->id)
                ->where('recentOrders.0.order_status', 'cancelled')
                ->where('recentOrders.0.payment_status', 'refunded')
                ->where('recentOrders.0.shipping_href', route('admin.orders.show', $cancelled).'#lacak-pesanan')
                ->where('recentOrders.0.href', route('admin.orders.show', $cancelled))
                ->where('recentOrders.0.whatsapp_url', 'https://wa.me/628123456789')
            );
    }

    public function test_attention_includes_issue_orders_after_fulfillment_aging_alerts(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $pending = $this->makeOrder([
            'order_number' => 'RA-DASH-ATTENTION-PENDING-'.uniqid(),
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
        ]);
        $pending->forceFill(['created_at' => now()->subDays(2), 'updated_at' => now()])->save();

        $processing = $this->makeOrder([
            'order_number' => 'RA-DASH-ATTENTION-PROCESSING-'.uniqid(),
            'order_status' => 'processing',
        ]);
        $processing->forceFill(['updated_at' => now()->subDays(2)])->save();

        $delivered = $this->makeOrder([
            'order_number' => 'RA-DASH-ATTENTION-DELIVERED-'.uniqid(),
            'order_status' => 'delivered',
        ]);
        $delivered->forceFill(['updated_at' => now()->subDays(3)])->save();

        $return = $this->makeOrder([
            'order_number' => 'RA-DASH-ATTENTION-RETURN-'.uniqid(),
            'order_status' => 'return_in_process',
        ]);
        $return->forceFill(['updated_at' => now()->subDays(8)])->save();

        $issue = $this->makeOrder([
            'order_number' => 'RA-DASH-ATTENTION-ISSUE-'.uniqid(),
            'order_status' => 'issue',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('attention.0.key', 'confirm_overdue')
                ->where('attention.1.key', 'processing_overdue')
                ->where('attention.2.key', 'delivered_stale')
                ->where('attention.3.key', 'return_overdue')
                ->where('attention.4.key', 'issue_orders')
                ->where('attention.4.count', 1)
                ->where('attention.4.href', route('admin.orders.index', ['order_status' => 'issue']))
            );
    }

    public function test_dashboard_hides_empty_attention_items(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->where('attention', [])
            );
    }

    public function test_dashboard_revenue_and_units_ignore_pending_and_cancelled_orders(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
        $product = Product::create([
            'parent_sku' => 'WIN-DASH',
            'name' => 'Jendela dashboard',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $fulfilled = $this->makeOrder([
            'order_number' => 'RA-DASH-FULFILLED-'.uniqid(),
            'order_status' => 'processing',
            'total_amount' => 2_000_000,
        ]);
        OrderItem::create([
            'order_id' => $fulfilled->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-DASH-1',
            'variant_sku' => 'WIN-DASH-1-V1',
            'name' => 'Jendela dashboard',
            'unit_price' => 2_000_000,
            'quantity' => 2,
            'line_subtotal' => 2_000_000,
            'line_discount' => 0,
            'line_total' => 2_000_000,
        ]);
        Payment::create([
            'order_id' => $fulfilled->id,
            'payment_method' => 'transfer',
            'amount' => 2_000_000,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $pending = $this->makeOrder([
            'order_number' => 'RA-DASH-PENDING-'.uniqid(),
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'total_amount' => 9_000_000,
        ]);
        OrderItem::create([
            'order_id' => $pending->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-DASH-2',
            'variant_sku' => 'WIN-DASH-2-V1',
            'name' => 'Jendela belum bayar',
            'unit_price' => 9_000_000,
            'quantity' => 9,
            'line_subtotal' => 9_000_000,
            'line_discount' => 0,
            'line_total' => 9_000_000,
        ]);

        $cancelled = $this->makeOrder([
            'order_number' => 'RA-DASH-CANCELLED-'.uniqid(),
            'order_status' => 'cancelled',
            'total_amount' => 8_000_000,
        ]);
        OrderItem::create([
            'order_id' => $cancelled->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-DASH-3',
            'variant_sku' => 'WIN-DASH-3-V1',
            'name' => 'Jendela dibatalkan',
            'unit_price' => 8_000_000,
            'quantity' => 8,
            'line_subtotal' => 8_000_000,
            'line_discount' => 0,
            'line_total' => 8_000_000,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('omzet.revenue', 2_000_000)
                ->where('omzet.orders', 2)
                ->where('omzet.units', 2)
                ->where('financial.pending_payment_amount', 9_000_000)
                ->where('financial.pending_payment_orders', 1)
                ->where('financial.active_order_amount', 2_000_000)
                ->where('financial.active_order_count', 1)
                ->where('financial.received_today_amount', 2_000_000)
                ->where('financial.received_today_count', 1)
            );
    }

    public function test_dashboard_surfaces_failed_import_and_media_operations(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => 'catalog.xlsx',
            'source_file_path' => 'catalog/catalog.xlsx',
            'status' => 'failed',
            'failed_rows' => 3,
        ]);
        MediaAsset::create([
            'kind' => 'image',
            'status' => 'failed',
            'visibility' => 'visible',
        ]);
        MediaAsset::create([
            'kind' => 'image',
            'status' => 'pending',
            'visibility' => 'visible',
        ]);
        MediaAsset::create([
            'kind' => 'image',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);
        MediaAsset::create([
            'kind' => 'image',
            'status' => 'ready',
            'visibility' => 'archived',
        ]);
        ImportJob::create([
            'type' => 'shopee_mass_update',
            'source_file_name' => 'catalog-complete.xlsx',
            'source_file_path' => 'catalog/catalog-complete.xlsx',
            'status' => 'completed',
            'failed_rows' => 2,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('attention.0.key', 'failed_media_assets')
                ->where('attention.1.key', 'pending_media')
                ->where('attention.2.key', 'failed_imports')
                ->where('importMediaSummary.imports.failed', 1)
                ->where('importMediaSummary.imports.completed', 1)
                ->where('importMediaSummary.imports.failed_rows', 5)
                ->where('importMediaSummary.media.shared_assets.failed', 1)
                ->where('importMediaSummary.media.shared_assets.pending', 1)
                ->where('importMediaSummary.media.shared_assets.ready', 1)
                ->where('importMediaSummary.media.shared_assets.archived', 1)
            );
    }
}
