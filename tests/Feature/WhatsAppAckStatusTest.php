<?php

namespace Tests\Feature;

use App\Models\WhatsAppMessage;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WhatsAppAckStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function ack(string $providerId, mixed $ack): void
    {
        app(WhatsAppService::class)->handleBaileysWebhook([
            'event' => 'message.ack',
            'session' => 'modu',
            'payload' => ['id' => $providerId, 'ack' => $ack],
        ]);
    }

    public function test_ack_does_not_downgrade_inbound_message_to_pending(): void
    {
        $msg = WhatsAppMessage::create([
            'phone_number' => '6285725116817',
            'direction' => 'inbound',
            'status' => 'received',
            'content_text' => 'siap kak',
            'provider' => 'baileys',
            'provider_message_id' => 'inbound-ack-1',
            'received_at' => now(),
        ]);

        // WhatsApp juga mengirim ack untuk pesan masuk. Nilai yang tidak
        // terpetakan tidak boleh menimpa status 'received'.
        $this->ack('inbound-ack-1', 0);

        $this->assertSame('received', $msg->fresh()->status);
    }

    public function test_ack_updates_outbound_message(): void
    {
        WhatsAppMessage::create([
            'phone_number' => '6285725116817',
            'direction' => 'outbound',
            'status' => 'pending',
            'content_text' => 'Pesanan diproses',
            'provider' => 'baileys',
            'provider_message_id' => 'outbound-ack-1',
        ]);

        $this->ack('outbound-ack-1', 2);

        $this->assertSame('delivered', WhatsAppMessage::where('provider_message_id', 'outbound-ack-1')->first()->status);
    }

    public function test_late_ack_does_not_downgrade_read_status(): void
    {
        WhatsAppMessage::create([
            'phone_number' => '6285725116817',
            'direction' => 'outbound',
            'status' => 'read',
            'content_text' => 'Pesanan dikirim',
            'provider' => 'baileys',
            'provider_message_id' => 'outbound-ack-2',
        ]);

        // Ack 'sent' datang terlambat setelah pesan sudah dibaca.
        $this->ack('outbound-ack-2', 1);

        $this->assertSame('read', WhatsAppMessage::where('provider_message_id', 'outbound-ack-2')->first()->status);
    }
}
