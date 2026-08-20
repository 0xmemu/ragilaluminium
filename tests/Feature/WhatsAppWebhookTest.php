<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WhatsAppWebhookTest extends TestCase
{
    use RefreshDatabase;

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

}
