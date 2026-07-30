<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;

class WhatsAppWebhookTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_inbound_message_is_logged(): void
    {
        $payload = ['entry' => [['changes' => [['value' => ['messages' => [['from' => '62812', 'id' => 'w1', 'text' => ['body' => 'Halo']]], 'statuses' => []]]]]]];

        $this->postJson('/webhook/whatsapp', $payload)->assertStatus(200);

        $this->assertDatabaseHas('whatsapp_messages', ['direction' => 'inbound', 'phone_number' => '62812', 'provider' => 'meta', 'status' => 'received']);
    }

    public function test_waha_inbound_message_is_logged(): void
    {
        config(['services.whatsapp.waha.webhook_secret' => 'secret-waha']);

        $payload = [
            'event' => 'message',
            'session' => 'default',
            'payload' => [
                'id' => 'waha-1',
                'from' => '6281234567890@c.us',
                'fromMe' => false,
                'body' => 'Halo dari WAHA',
            ],
        ];

        $this->postJson('/webhook/whatsapp/waha?secret=secret-waha', $payload)->assertOk();

        $this->assertDatabaseHas('whatsapp_messages', [
            'direction' => 'inbound',
            'phone_number' => '6281234567890',
            'provider' => 'waha',
            'provider_message_id' => 'waha-1',
            'status' => 'received',
        ]);
    }

    public function test_verify_returns_forbidden_without_token(): void
    {
        $this->get('/webhook/whatsapp?hub_mode=subscribe&hub_verify_token=x&hub_challenge=123')
            ->assertStatus(403);
    }
}
