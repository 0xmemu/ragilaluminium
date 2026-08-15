<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;

class OrderPrivacyTest extends \Tests\TestCase
{
    use RefreshDatabase;

    protected function makeOrder(): Order
    {
        return Order::create([
            'order_number' => 'RA-PRIV-1', 'customer_name' => 'Budi', 'customer_phone' => '628123456789',
            'customer_email' => 'budi@example.com',
            'shipping_address_line1' => 'Jl A', 'shipping_city' => 'Jakarta', 'shipping_province' => 'DKI',
            'shipping_postal_code' => '12345', 'order_status' => 'processing', 'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup', 'subtotal_amount' => 100000, 'total_amount' => 100000,
            'payment_method' => 'transfer',
        ]);
    }

    public function test_status_lookup_requires_identity(): void
    {
        $this->makeOrder();

        $this->post('/order/status', ['order_number' => 'RA-PRIV-1'])
            ->assertSessionHasErrors(['customer_phone']);
    }

    public function test_status_lookup_matches_with_normalized_phone(): void
    {
        $this->makeOrder();

        // 0812... harus dinormalisasi menjadi 62812... dan cocok.
        $this->post('/order/status', [
            'order_number' => 'RA-PRIV-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('searched', true)
            ->where('has_session_orders', true)
            ->where('order.order_number', 'RA-PRIV-1')
            ->has('orders', 1))
            ->assertSessionHas('confirmed_orders', fn ($list) => in_array('RA-PRIV-1', $list, true));
    }

    public function test_status_form_without_session_shows_empty_orders(): void
    {
        $this->makeOrder();

        $this->get('/order/status')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/OrderStatus')
                ->where('has_session_orders', false)
                ->where('searched', false)
                ->where('order', null)
                ->has('orders', 0));
    }

    public function test_status_form_with_session_loads_orders_without_lookup(): void
    {
        $this->makeOrder();

        $this->withSession(['confirmed_orders' => ['RA-PRIV-1']])
            ->get('/order/status')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/OrderStatus')
                ->where('has_session_orders', true)
                ->where('searched', false)
                ->where('order.order_number', 'RA-PRIV-1')
                ->has('orders', 1)
                ->where('orders.0.order_number', 'RA-PRIV-1'));
    }

    public function test_api_status_requires_identity(): void
    {
        $this->makeOrder();

        $this->getJson('/api/orders/RA-PRIV-1/status')->assertStatus(422);

        $this->getJson('/api/orders/RA-PRIV-1/status?customer_phone=08123456789')
            ->assertOk()
            ->assertJsonPath('order_number', 'RA-PRIV-1');
    }

    public function test_confirmation_redirects_without_session_token(): void
    {
        $this->makeOrder();

        $this->get('/order/RA-PRIV-1/confirmation')->assertRedirect(route('order.status'));
    }

    public function test_status_lookup_refreshes_jnt_and_returns_shipping(): void
    {
        config(['jnt.enabled' => true]);

        $order = $this->makeOrder();
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-PRIV-1',
            'shipping_cost' => 0,
            'status' => 'pending_pickup',
            'last_status_at' => now()->subMinutes(10),
        ]);

        $client = Mockery::mock(JntCargoClient::class);
        $client->shouldReceive('isEnabled')->andReturn(true);
        $client->shouldReceive('track')
            ->once()
            ->with(['billCodes' => 'JT-PRIV-1'])
            ->andReturn(new JntResponse(
                true,
                200,
                [
                    'data' => [
                        'details' => [[
                            'scanType' => '3',
                            'desc' => 'Paket dalam perjalanan',
                            'scanTime' => now()->toDateTimeString(),
                        ]],
                    ],
                ],
                'req-test-1',
                12,
            ));
        $this->app->instance(JntCargoClient::class, $client);

        $this->post('/order/status', [
            'order_number' => 'RA-PRIV-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('has_session_orders', true)
            ->where('order.shipping.waybill_number', 'JT-PRIV-1')
            ->where('order.shipping.carrier_name', 'J&T Cargo')
            ->where('order.shipping_status', 'in_transit'));
    }
}