<?php

namespace Tests\Feature;

use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppWahaDriverTest extends TestCase
{
    use RefreshDatabase;

    public function test_waha_send_uses_check_exists_typing_and_send_text(): void
    {
        Http::fake([
            'http://127.0.0.1:3000/api/contacts/check-exists*' => Http::response([
                'numberExists' => true,
                'chatId' => '6281234567890@c.us',
            ], 200),
            'http://127.0.0.1:3000/api/startTyping' => Http::response(['ok' => true], 200),
            'http://127.0.0.1:3000/api/stopTyping' => Http::response(['ok' => true], 200),
            'http://127.0.0.1:3000/api/sendText' => Http::response(['id' => 'waha-msg-1'], 200),
        ]);

        config([
            'services.whatsapp.driver' => 'waha',
            'services.whatsapp.waha.base_url' => 'http://127.0.0.1:3000',
            'services.whatsapp.waha.api_key' => 'test-key',
            'services.whatsapp.waha.session' => 'default',
            'services.whatsapp.meta.token' => null,
            'services.whatsapp.meta.number_id' => null,
        ]);

        WhatsAppTemplate::create([
            'internal_key' => 'order_created',
            'provider_template_name' => 'order_created_cod',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
            'body_preview' => 'Halo {{1}}, order {{2}} total {{3}}',
        ]);

        $message = app(WhatsAppService::class)->sendTemplateMessage(
            '081234567890',
            'order_created',
            ['Ragil', 'RA-TEST', '100.000'],
            null,
        );

        $this->assertNotNull($message);
        $this->assertSame('waha', $message->provider);
        $this->assertSame('sent', $message->status);
        $this->assertSame('waha-msg-1', $message->provider_message_id);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/api/contacts/check-exists'));
        Http::assertSent(fn ($request) => str_contains($request->url(), '/api/startTyping'));
        Http::assertSent(fn ($request) => str_contains($request->url(), '/api/stopTyping'));
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/api/sendText')
                && ($request['chatId'] ?? null) === '6281234567890@c.us'
                && str_contains((string) ($request['text'] ?? ''), 'RA-TEST');
        });
    }

    public function test_waha_webhook_hmac_sha512_accepts_valid_signature(): void
    {
        $secret = 'my-secret-key';
        $body = '{"event":"message","session":"default","payload":{"id":"waha-1","from":"62812@c.us","body":"Halo","fromMe":false}}';
        $hmac = hash_hmac('sha512', $body, $secret);

        config(['services.whatsapp.waha.hmac_secret' => $secret]);

        $this->call(
            'POST',
            '/api/webhooks/waha',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X-Webhook-Hmac' => $hmac,
                'HTTP_X-Webhook-Hmac-Algorithm' => 'sha512',
            ],
            $body,
        )->assertOk();

        $this->assertDatabaseHas('whatsapp_messages', [
            'direction' => 'inbound',
            'provider' => 'waha',
            'provider_message_id' => 'waha-1',
            'status' => 'received',
        ]);
    }

    public function test_waha_webhook_rejects_bad_hmac(): void
    {
        config(['services.whatsapp.waha.hmac_secret' => 'secret']);

        $this->postJson('/api/webhooks/waha', [
            'event' => 'message',
            'payload' => ['id' => 'x', 'from' => '62812@c.us', 'body' => 'x', 'fromMe' => false],
        ], [
            'X-Webhook-Hmac' => 'deadbeef',
            'X-Webhook-Hmac-Algorithm' => 'sha512',
        ])->assertForbidden();
    }

    public function test_session_status_failed_is_cached(): void
    {
        config(['services.whatsapp.waha.hmac_secret' => null, 'services.whatsapp.waha.webhook_secret' => null]);

        $this->postJson('/api/webhooks/waha', [
            'event' => 'session.status',
            'session' => 'default',
            'payload' => ['status' => 'FAILED'],
        ])->assertOk();

        $this->assertSame('FAILED', app(\App\Services\WhatsApp\WahaDriver::class)->sessionStatus());
    }

    public function test_meta_driver_still_works_when_selected(): void
    {
        Http::fake([
            'https://graph.facebook.com/*' => Http::response(['messages' => [['id' => 'meta-1']]], 200),
        ]);

        config([
            'services.whatsapp.driver' => 'meta',
            'services.whatsapp.meta.token' => 'meta-token',
            'services.whatsapp.meta.number_id' => '12345',
            'services.whatsapp.meta.base_url' => 'https://graph.facebook.com/v20.0',
            'services.whatsapp.token' => 'meta-token',
            'services.whatsapp.number_id' => '12345',
        ]);

        WhatsAppTemplate::create([
            'internal_key' => 'payment_confirmed',
            'provider_template_name' => 'payment_confirmed',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
        ]);

        $message = app(WhatsAppService::class)->sendTemplateMessage('081234567890', 'payment_confirmed', ['RA-1']);

        $this->assertSame('meta', $message->provider);
        $this->assertSame('sent', $message->status);
        $this->assertSame('meta-1', $message->provider_message_id);
    }
}
