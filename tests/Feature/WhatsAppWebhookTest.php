<?php

namespace Tests\Feature;

use App\Models\WhatsAppMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;

class WhatsAppWebhookTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_inbound_message_is_logged(): void
    {
        $payload = ['entry' => [['changes' => [['value' => ['messages' => [['from' => '62812', 'id' => 'w1', 'text' => ['body' => 'Halo']]], 'statuses' => []]]]]]];

        $this->postJson('/webhook/whatsapp', $payload)->assertStatus(200);

        $this->assertDatabaseHas('whatsapp_messages', ['direction' => 'inbound', 'phone_number' => '62812', 'status' => 'received']);
    }

    public function test_verify_returns_forbidden_without_token(): void
    {
        $this->get('/webhook/whatsapp?hub_mode=subscribe&hub_verify_token=x&hub_challenge=123')
            ->assertStatus(403);
    }
}
