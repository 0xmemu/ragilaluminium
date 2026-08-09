<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WhatsAppWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_inbound_message_is_logged(): void
    {
        $payload = ['entry' => [['changes' => [['value' => ['messages' => [['from' => '62812', 'id' => 'w1', 'text' => ['body' => 'Halo']]], 'statuses' => []]]]]]];

        config(['services.whatsapp.app_secret' => 'meta-app-secret']);
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $signature = 'sha256='.hash_hmac('sha256', $body, 'meta-app-secret');

        $this->call(
            'POST',
            '/webhook/whatsapp',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_HUB_SIGNATURE_256' => $signature,
            ],
            $body,
        )->assertOk();

        $this->assertDatabaseHas('whatsapp_messages', ['direction' => 'inbound', 'phone_number' => '62812', 'provider' => 'meta', 'status' => 'received']);
    }

    public function test_baileys_inbound_message_is_logged(): void
    {
        config(['services.whatsapp.baileys.webhook_secret' => 'secret-baileys']);

        $payload = [
            'event' => 'message',
            'session' => 'default',
            'payload' => [
                'id' => 'baileys-1',
                'from' => '6281234567890@c.us',
                'fromMe' => false,
                'body' => 'Halo dari BAILEYS',
            ],
        ];

        $this->withHeader('X-Webhook-Secret', 'secret-baileys')
            ->postJson('/webhook/whatsapp/baileys', $payload)->assertOk();

        $this->assertDatabaseHas('whatsapp_messages', [
            'direction' => 'inbound',
            'phone_number' => '6281234567890',
            'provider' => 'baileys',
            'provider_message_id' => 'baileys-1',
            'status' => 'received',
        ]);
    }

    public function test_verify_returns_forbidden_without_token(): void
    {
        $this->get('/webhook/whatsapp?hub_mode=subscribe&hub_verify_token=x&hub_challenge=123')
            ->assertStatus(403);
    }
}
