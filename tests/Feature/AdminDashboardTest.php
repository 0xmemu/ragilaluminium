<?php

namespace Tests\Feature;

use App\Models\Order;
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
                ->has('omzet.revenue')
                ->has('omzet.orders_delta')
                ->has('omzet.units_delta')
                ->has('omzet.sparkline')
                ->has('performa.metrics', 4)
                ->where('performa.period', 'today')
                ->has('performa.period_options')
                ->has('statusOrder', 5)
                ->has('attention')
                ->has('quickActions', 4)
                ->where('quickActions.0.label', 'Buat Promo Toko')
                ->where('quickActions.1.label', 'Buat Voucher')
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
                ->where('statusOrder.2.href', route('admin.orders.index', ['order_status' => 'shipped']))
            );
    }
}
