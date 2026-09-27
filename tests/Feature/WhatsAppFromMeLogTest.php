<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\WhatsAppMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Log WhatsApp mencatat juga pesan yang diketik admin langsung dari
 * perangkat toko (HP/WhatsApp Web), dan pesan hasil kirim ulang berlabel
 * dengan akhiran " Ulang" (owner 2026-09-27).
 *
 * Kontrak:
 * - Webhook event=message dengan fromMe=true -> baris pesan keluar manual
 *   (tanpa kunci templat, tanpa tanda Otomatis).
 * - Pesan yang dikirim lewat gateway tidak diduplikasi: id pesannya sudah
 *   tersimpan saat pengiriman.
 * - Baris dengan raw_payload.resend tampil berlabel berakhiran " Ulang".
 */
class WhatsAppFromMeLogTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function order(): Order
    {
        return Order::create([
            'order_number' => 'RA-WFM-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '085725116817',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
    }

    private function kirimWebhookFromMe(string $id, string $teks): void
    {
        config(['services.whatsapp.baileys.webhook_secret' => 'secret-baileys']);

        $this->withHeader('X-Webhook-Secret', 'secret-baileys')
            ->postJson('/webhook/whatsapp/baileys', [
                'event' => 'message',
                'session' => 'default',
                'payload' => [
                    'id' => $id,
                    'from' => '6285725116817@c.us',
                    'fromMe' => true,
                    'body' => $teks,
                ],
            ])->assertOk();
    }

    public function test_pesan_dari_hp_admin_tercatat_outbound_manual(): void
    {
        $this->kirimWebhookFromMe('fromme-1', 'Catatan manual dari HP admin');

        $this->assertDatabaseHas('whatsapp_messages', [
            'direction' => 'outbound',
            'phone_number' => '6285725116817',
            'provider_message_id' => 'fromme-1',
            'content_text' => 'Catatan manual dari HP admin',
            'status' => 'sent',
        ]);

        $pesan = WhatsAppMessage::where('provider_message_id', 'fromme-1')->first();
        $this->assertNull($pesan->internal_template_key);
    }

    public function test_kiriman_gateway_tidak_tercatat_ganda(): void
    {
        $order = $this->order();
        $pesan = WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $order->id,
            'phone_number' => '6285725116817',
            'provider' => 'baileys',
            'internal_template_key' => 'order_created',
            'provider_message_id' => 'WA-GATEWAY-1',
            'status' => 'sent',
            'content_text' => 'Naskah konfirmasi',
        ]);
        $jumlahAwal = WhatsAppMessage::count();

        // Bot meneruskan juga kiriman gateway sebagai fromMe; aplikasi
        // mengenali id-nya dan tidak membuat baris kedua.
        $this->kirimWebhookFromMe('WA-GATEWAY-1', 'Naskah konfirmasi');

        $this->assertSame($jumlahAwal, WhatsAppMessage::count());
        $this->assertSame('order_created', $pesan->fresh()->internal_template_key);
    }

    public function test_label_pesan_terkirim_ulang_berakhiran_ulang(): void
    {
        $order = $this->order();
        WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $order->id,
            'phone_number' => '6285725116817',
            'provider' => 'baileys',
            'internal_template_key' => 'order_created',
            'provider_message_id' => 'WA-RES-1',
            'status' => 'sent',
            'content_text' => 'Naskah konfirmasi',
            'raw_payload' => ['resend' => ['status' => 'failed', 'error_reason' => 'gateway down']],
        ]);

        $this->actingAs($this->admin())
            ->get(route('admin.orders.show', $order))
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.whatsapp_messages.0.label', fn ($label) => str_contains((string) $label, '(Ulang)')));
    }
}
