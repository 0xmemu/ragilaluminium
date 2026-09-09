<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminShippingIndexTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_guest_redirected_to_login(): void
    {
        $this->get(route('admin.shipping.index'))
            ->assertRedirect(route('login'));
    }

    public function test_admin_can_view_shipping_index(): void
    {
        $order = Order::create([
            'order_number' => 'ORD26080001',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Merdeka 10',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'subtotal_amount' => 500000,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
        ]);

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'service_name' => 'Kargo Darat',
            'waybill_number' => '201718781511',
            'status' => 'delivered',
            'status_raw' => 'Paket diterima oleh penerima',
            'last_status_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->has('summary')
                ->where('summary.total_delivered', 1)
                ->where('summary.total_in_transit', 0)
                ->has('tabs', 5)
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', '201718781511')
                ->where('records.data.0.customer_name', 'Budi Santoso')
                ->where('records.data.0.status', 'delivered')
            );
    }

    public function test_admin_can_filter_shipping_by_status(): void
    {
        $order1 = Order::create([
            'order_number' => 'ORD26080010',
            'customer_name' => 'Delivered Order',
            'customer_phone' => '08111111111',
            'shipping_address_line1' => 'Jl. A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '10110',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'order_status' => 'completed',
            'shipping_status' => 'delivered',
        ]);

        ShippingRecord::create([
            'order_id' => $order1->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-DELIVERED-1',
            'status' => 'delivered',
        ]);

        $order2 = Order::create([
            'order_number' => 'ORD26080020',
            'customer_name' => 'In Transit Order',
            'customer_phone' => '08222222222',
            'shipping_address_line1' => 'Jl. B',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40115',
            'subtotal_amount' => 200000,
            'total_amount' => 200000,
            'payment_method' => 'transfer',
            'order_status' => 'shipped',
            'shipping_status' => 'in_transit',
        ]);

        ShippingRecord::create([
            'order_id' => $order2->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-TRANSIT-1',
            'status' => 'in_transit',
        ]);

        // Filter status=delivered
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['status' => 'delivered']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-DELIVERED-1')
            );

        // Filter status=in_transit
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['status' => 'in_transit']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-TRANSIT-1')
            );
    }
}
