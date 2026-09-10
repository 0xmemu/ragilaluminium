<?php

namespace Tests\Feature;

use App\Models\WhatsAppMessage;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WhatsAppGroupFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function payload(string $from): array
    {
        return [
            'event' => 'message',
            'session' => 'modu',
            'payload' => [
                'id' => 'wamid-'.uniqid(),
                'from' => $from,
                'body' => 'halo',
                'fromMe' => false,
            ],
        ];
    }

    public function test_group_and_channel_messages_are_ignored(): void
    {
        $service = app(WhatsAppService::class);

        foreach ([
            '120363151880690386@g.us',
            '120363363090730395@newsletter',
            'status@broadcast',
        ] as $from) {
            $service->handleBaileysWebhook($this->payload($from));
        }

        $this->assertSame(0, WhatsAppMessage::count());
    }

    public function test_personal_number_outside_customer_list_is_accepted(): void
    {
        app(WhatsAppService::class)->handleBaileysWebhook($this->payload('6281234567890@s.whatsapp.net'));

        $this->assertSame(1, WhatsAppMessage::where('direction', 'inbound')->count());
        $this->assertDatabaseHas('whatsapp_messages', [
            'phone_number' => '6281234567890',
            'direction' => 'inbound',
        ]);
    }
}
