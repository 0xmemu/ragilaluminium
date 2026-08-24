<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P0 Task 2 — API Rate Limit Consistency.
 *
 * /api/orders/{order_number}/status disamakan dgn lookup public: 10/menit
 * (sebelumnya 60/menit — rentan enumerasi). /api/health/ready tetap 60/menit.
 */
class ApiRateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function makeOrder(): Order
    {
        return Order::create([
            'order_number' => 'RA-RL-1',
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_district' => 'Menteng',
            'shipping_postal_code' => '10310',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
        ]);
    }

    public function test_order_status_api_throttles_at_10_per_minute(): void
    {
        $this->makeOrder();

        // 10 request valid di bawah limit -> bukan 429.
        for ($i = 0; $i < 10; $i++) {
            $resp = $this->getJson('/api/orders/RA-RL-1/status?customer_phone=08123456789');
            $this->assertNotSame(429, $resp->status(), "request ke-".($i + 1).' harus lolos');
        }

        // Request ke-11 -> 429.
        $this->getJson('/api/orders/RA-RL-1/status?customer_phone=08123456789')
            ->assertStatus(429);
    }

    public function test_health_api_throttles_at_60_per_minute(): void
    {
        // 60 request lolos.
        for ($i = 0; $i < 60; $i++) {
            $resp = $this->getJson('/api/health/ready');
            $this->assertNotSame(429, $resp->status(), 'health ke-'.($i + 1));
        }

        $this->getJson('/api/health/ready')->assertStatus(429);
    }
}