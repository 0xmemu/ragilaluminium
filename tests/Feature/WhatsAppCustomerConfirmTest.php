<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class WhatsAppCustomerConfirmTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        WhatsAppTemplate::create([
            'internal_key' => 'payment_confirmed',
            'provider_template_name' => 'payment_confirmed',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
        ]);
    }

    private function postBaileysMessage(string $chatId, string $body, string $id): TestResponse
    {
        config(['services.whatsapp.baileys.webhook_secret' => 'baileys-secret']);

        return $this->withHeader('X-Webhook-Secret', 'baileys-secret')
            ->postJson('/webhook/whatsapp/baileys', [
                'event' => 'message',
                'session' => 'default',
                'payload' => [
                    'id' => $id,
                    'from' => $chatId,
                    'fromMe' => false,
                    'body' => $body,
                ],
            ]);
    }

    public function test_customer_reply_does_not_auto_process_cod_order(): void
    {
        Queue::fake();

        $order = Order::create([
            'order_number' => 'RA-260726-CONFIRM',
            'customer_name' => 'Budi',
            'customer_phone' => '6285711122233',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $order->id,
            'phone_number' => '6285711122233',
            'internal_template_key' => 'order_created',
            'status' => 'sent',
            'sent_at' => now(),
            'content_payload' => ['variables' => []],
        ]);

        $this->postBaileysMessage('6285711122233@c.us', 'Oke, Proses Pesanan', 'wamid.button-confirm-1')
            ->assertOk();

        $order->refresh();
        // Mode fully manual: status pesanan tetap awaiting_confirmation (tidak auto processing)
        $this->assertSame('awaiting_confirmation', $order->order_status);
        $this->assertSame('pending', $order->payment_status);

        // Pesan masuk tetap terhubung ke order_id untuk rekaman riwayat admin
        $inbound = WhatsAppMessage::query()->where('provider_message_id', 'wamid.button-confirm-1')->first();
        $this->assertNotNull($inbound);
        $this->assertSame($order->id, $inbound->order_id);
    }

    public function test_transfer_order_not_auto_processed_by_ok_text(): void
    {
        $order = Order::create([
            'order_number' => 'RA-260726-TRFOK',
            'customer_name' => 'Ani',
            'customer_phone' => '6285799988877',
            'shipping_address_line1' => 'Jl B',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 200000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        $this->postBaileysMessage('6285799988877@c.us', 'Oke', 'wamid.text-ok-1')
            ->assertOk();

        $order->refresh();
        $this->assertSame('awaiting_confirmation', $order->order_status);
    }
}
