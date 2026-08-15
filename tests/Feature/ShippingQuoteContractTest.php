<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\Order;
use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use App\Services\ShippingService;
use App\Support\ShippingQuoteManualReviewNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShippingQuoteContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_endpoint_returns_local_fallback_when_jnt_is_not_ready(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(false);
            $mock->shouldNotReceive('tariff');
        });

        $response = $this->postJson('/api/shipping/quote', [
            'weight_kg' => 2,
            'destination_city' => 'KOTA BANDUNG',
            'destination_province' => 'JAWA BARAT',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.state', 'fallback')
            ->assertJsonPath('data.is_final', false)
            ->assertJsonPath('data.manual_review', false)
            ->assertJsonPath('data.net', 19000);
    }

    public function test_provider_failure_returns_local_provisional_quote_without_provider_error(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andThrow(new \RuntimeException('provider secret must not reach customer'));
        });

        $quote = app(ShippingService::class)->quote(3.5, 'KOTA BANDUNG', 'JAWA BARAT');

        $this->assertSame('manual_review', $quote['state']);
        $this->assertFalse($quote['is_final']);
        $this->assertTrue($quote['manual_review']);
        $this->assertSame(22000.0, $quote['net']);
        $this->assertStringNotContainsString('provider secret', $quote['message']);
    }

    public function test_live_jnt_quote_is_final_when_tariff_is_available(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => ['estimateSumFreight' => 42000]],
                requestId: 'quote-1',
                elapsedMs: 120,
            ));
        });

        $quote = app(ShippingService::class)->quote(2, 'KOTA BANDUNG', 'JAWA BARAT');

        $this->assertSame('ready', $quote['state']);
        $this->assertTrue($quote['is_final']);
        $this->assertFalse($quote['manual_review']);
        $this->assertSame(42000.0, $quote['net']);
    }

    public function test_manual_review_notification_is_deduplicated_per_order(): void
    {
        $order = Order::create([
            'order_number' => 'RA-QUOTE-'.uniqid(),
            'customer_name' => 'Budi',
            'customer_phone' => '628123',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'KOTA BANDUNG',
            'shipping_province' => 'JAWA BARAT',
            'shipping_postal_code' => '40132',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'total_amount' => 119000,
            'payment_method' => 'transfer',
        ]);

        $quote = ['rough_estimate' => 22000];
        ShippingQuoteManualReviewNotifier::notify($order, $quote);
        ShippingQuoteManualReviewNotifier::notify($order, $quote);

        $this->assertSame(1, AdminNotification::where('type', 'shipping_quote_manual_review')
            ->where('related_id', $order->id)
            ->whereNull('read_at')
            ->count());
    }
}
