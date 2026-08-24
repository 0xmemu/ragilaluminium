<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P0 Task 1 — Webhook Signature Verification.
 *
 * Middleware verify.jnt.signature (digest md5(bizContent+key), 401 bila invalid)
 * dan verify.baileys.key (HMAC/plain secret, 403 bila invalid).
 */
class WebhookSignatureTest extends TestCase
{
    use RefreshDatabase;

    protected function jntDigest(string $bizContent, string $key): string
    {
        return base64_encode(md5($bizContent.$key, true));
    }

    public function test_jnt_webhook_rejects_invalid_signature(): void
    {
        config(['jnt.webhook.private_key' => 'webhook-secret']);

        $this->withHeader('digest', base64_encode(md5('{}wrong', true)))
            ->post('/webhook/shipping/jnt', ['bizContent' => '{}'])
            ->assertStatus(401);
    }

    public function test_jnt_webhook_accepts_valid_signature(): void
    {
        config(['jnt.webhook.private_key' => 'webhook-secret']);

        $order = Order::create([
            'order_number' => 'RA-SIG-1',
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_district' => 'Menteng',
            'shipping_postal_code' => '10310',
            'order_status' => 'shipped',
            'payment_status' => 'paid',
            'shipping_status' => 'in_transit',
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
        ]);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-SIG-1',
            'shipping_cost' => 0,
            'status' => 'in_transit',
        ]);

        $biz = json_encode(['billCode' => 'JT-SIG-1', 'details' => [
            ['scanType' => '10', 'desc' => 'diterima', 'scanTime' => '2026-01-01 10:00:00'],
        ]]);

        $this->withHeader('digest', $this->jntDigest($biz, 'webhook-secret'))
            ->post('/webhook/shipping/jnt', ['bizContent' => $biz])
            ->assertOk()
            ->assertJsonPath('code', config('jnt.ack.code'));

        $this->assertEquals('delivered', $order->fresh()->order_status);
    }

    public function test_baileys_webhook_rejects_invalid_key(): void
    {
        config(['services.whatsapp.baileys.webhook_secret' => 'secret-a']);

        $this->withHeader('X-Webhook-Secret', 'secret-b')
            ->postJson('/webhook/whatsapp/baileys', ['event' => 'message'])
            ->assertStatus(403);
    }

    public function test_baileys_webhook_accepts_valid_key(): void
    {
        config(['services.whatsapp.baileys.webhook_secret' => 'secret-a']);

        $payload = [
            'event' => 'message',
            'session' => 'default',
            'payload' => [
                'id' => 'sig-1',
                'from' => '6281234567890@c.us',
                'fromMe' => false,
                'body' => 'Halo dari test',
            ],
        ];

        $this->withHeader('X-Webhook-Secret', 'secret-a')
            ->postJson('/webhook/whatsapp/baileys', $payload)
            ->assertOk();

        $this->assertDatabaseHas('whatsapp_messages', [
            'direction' => 'inbound',
            'phone_number' => '6281234567890',
            'provider' => 'baileys',
            'status' => 'received',
        ]);
    }

    public function test_baileys_webhook_accepts_valid_hmac(): void
    {
        config(['services.whatsapp.baileys.webhook_secret' => 'secret-hmac']);

        $payload = ['event' => 'message', 'session' => 'default', 'payload' => ['id' => 'sig-hmac']];
        $body = json_encode($payload);
        $hmac = hash_hmac('sha512', $body, 'secret-hmac');

        $this->withHeaders(['X-Webhook-Hmac' => $hmac, 'X-Webhook-Hmac-Algorithm' => 'sha512'])
            ->postJson('/webhook/whatsapp/baileys', $payload)
            ->assertOk();
    }
}