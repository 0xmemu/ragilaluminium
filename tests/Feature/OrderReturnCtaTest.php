<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Phase D — Tracking normalization, delivered confirmation & return CTA.
 */
class OrderReturnCtaTest extends TestCase
{
    use RefreshDatabase;

    protected function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-RC-1',
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_district' => 'Menteng',
            'shipping_postal_code' => '10310',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
        ], $overrides));
    }

    private function deliveredRecord(Order $order, int $hoursAgo = 1): ShippingRecord
    {
        return ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-RC-1',
            'status' => 'delivered',
            'status_raw' => 'RAW-DELIVERED-INTERNAL',
            'last_status_at' => now()->subHours($hoursAgo),
        ]);
    }

    public function test_delivered_paid_within_window_returns_eligible_block_and_cta(): void
    {
        $order = $this->makeOrder();
        $this->deliveredRecord($order, 5);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.order_number', 'RA-RC-1')
            ->where('order.return_block.eligible', true)
            ->where('order.delivered_at', fn ($v) => is_string($v) && $v !== '')
            ->where('order.return_whatsapp_url', fn ($url) => is_string($url) && str_contains($url, 'wa.me/'))
            ->where('order.return_block.deadline', fn ($d) => is_string($d) && $d !== ''));
    }

    public function test_delivered_unpaid_has_safe_reason_without_internal_note(): void
    {
        $order = $this->makeOrder(['payment_status' => 'pending']);
        $this->deliveredRecord($order, 5);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.return_block.eligible', false)
            ->where('order.return_block.reason', fn ($r) => is_string($r) && ! str_contains($r, 'RAW-')));
    }

    public function test_delivered_past_window_reason_is_customer_safe(): void
    {
        $order = $this->makeOrder();
        $this->deliveredRecord($order, 60); // > 48 jam

        $this->post('/order/status', [
            'order_number' => 'RA-RC-1',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.return_block.eligible', false)
            ->where('order.return_block.reason', fn ($r) => is_string($r)
                && ! str_contains($r, 'RAW-')
                && ! str_contains($r, 'internal')));
    }

    public function test_completed_order_has_no_return_block_and_copy_says_finished(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-2',
            'order_status' => 'completed',
            'shipping_status' => 'delivered',
        ]);
        $this->deliveredRecord($order, 100);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-2',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.order_status', 'completed')
            ->where('order.return_block.eligible', false)
            // Copy Phase A2: selesai, tidak ada retur baru.
            ->where('order.vm.primaryStatus.key', 'completed')
            ->where('order.vm.primaryStatus.message', fn ($m) => is_string($m) && str_contains($m, 'Retur baru tidak tersedia')));
    }

    public function test_tracking_public_never_leaks_raw_provider_text(): void
    {
        $order = $this->makeOrder([
            'order_number' => 'RA-RC-3',
            'order_status' => 'processing',
        ]);
        // Pastikan order ini memang bukan delivered agar tidak terpengaruh kartu retur.
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-RC-3',
            'status' => 'in_transit',
            'status_raw' => 'RAW-PROVIDER-CODE-XYZ',
            'last_status_at' => now()->subHour(),
        ]);

        $this->post('/order/status', [
            'order_number' => 'RA-RC-3',
            'customer_phone' => '08123456789',
        ])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Public/OrderStatus')
            ->where('order.order_number', 'RA-RC-3'));

        // via API: tracking_public timeline bebas raw
        $res = $this->getJson('/api/orders/RA-RC-3/status?customer_phone=08123456789')->assertOk()->json();
        foreach (($res['tracking_public']['timeline'] ?? []) as $entry) {
            $this->assertStringNotContainsString('RAW-PROVIDER-CODE-XYZ', $entry['message'] ?? '');
        }
    }
}