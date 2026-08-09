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

    /** @param array<string, mixed> $payload */
    private function postSignedMeta(array $payload): TestResponse
    {
        config(['services.whatsapp.app_secret' => 'meta-app-secret']);
        $body = json_encode($payload, JSON_THROW_ON_ERROR);

        return $this->call(
            'POST',
            '/webhook/whatsapp',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_HUB_SIGNATURE_256' => 'sha256='.hash_hmac('sha256', $body, 'meta-app-secret'),
            ],
            $body,
        );
    }

    public function test_button_reply_processes_cod_order(): void
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
            'order_status' => 'pending_payment',
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

        $payload = [
            'entry' => [[
                'changes' => [[
                    'value' => [
                        'messages' => [[
                            'from' => '6285711122233',
                            'id' => 'wamid.button-confirm-1',
                            'timestamp' => (string) time(),
                            'type' => 'interactive',
                            'interactive' => [
                                'type' => 'button_reply',
                                'button_reply' => [
                                    'id' => 'confirm_order',
                                    'title' => 'Oke, Proses Pesanan',
                                ],
                            ],
                        ]],
                        'statuses' => [],
                    ],
                ]],
            ]],
        ];

        $this->postSignedMeta($payload)->assertOk();

        $order->refresh();
        $this->assertSame('processing', $order->order_status);
        $this->assertSame('pending', $order->payment_status);

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
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 200000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        $payload = [
            'entry' => [[
                'changes' => [[
                    'value' => [
                        'messages' => [[
                            'from' => '6285799988877',
                            'id' => 'wamid.text-ok-1',
                            'type' => 'text',
                            'text' => ['body' => 'Oke'],
                        ]],
                    ],
                ]],
            ]],
        ];

        $this->postSignedMeta($payload)->assertOk();

        $order->refresh();
        $this->assertSame('pending_payment', $order->order_status);
    }
}
