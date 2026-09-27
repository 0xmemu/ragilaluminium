<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Cek pra-kirim WA (temuan owner 2026-09-27): pesan otomatis bisa tercatat
 * "Terkirim" padahal nomor tujuan tidak terdaftar WhatsApp, karena gateway
 * menerima serahan tanpa cek registrasi.
 *
 * Kontrak:
 * - /api/on-whatsapp menjawab exists=false -> pesan langsung gagal dengan
 *   alasan "Nomor tidak terdaftar WhatsApp." dan TIDAK diserahkan ke endpoint
 *   kirim gateway.
 * - exists=true -> pengiriman berjalan normal.
 * - Endpoint tidak tersedia (404) -> kirim tetap berjalan (fail-open).
 */
class WhatsAppPreSendCheckTest extends TestCase
{
    use RefreshDatabase;

    private function order(): Order
    {
        return Order::create([
            'order_number' => 'RA-WAP-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
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
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    public function test_nomor_tidak_terdaftar_gagal_sebelum_menyentuh_gateway_kirim(): void
    {
        Http::fake([
            // Baileys menyaring nomor mati: hasil kosong berarti tidak terdaftar.
            '*/api/on-whatsapp' => Http::response(['results' => []], 200),
            '*' => Http::response(['id' => 'WA-1'], 200),
        ]);

        $order = $this->order();
        $pesan = app(WhatsAppService::class)->sendTextMessage('628123456789', 'Uji nomor tidak terdaftar', $order->id);

        $this->assertSame('failed', $pesan->status);
        $this->assertSame('Nomor tidak terdaftar WhatsApp.', $pesan->error_reason);
        $this->assertSame('not_registered', $pesan->raw_payload['pre_send_check'] ?? null);

        // Tidak ada penyerahan ke endpoint kirim gateway.
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/api/sendText'));
    }

    public function test_nomor_terdaftar_dikirim_normal(): void
    {
        Http::fake([
            '*/api/on-whatsapp' => Http::response([
                'results' => [['jid' => '6285725116817@s.whatsapp.net', 'exists' => true]],
            ], 200),
            '*' => Http::response(['id' => 'WA-2'], 200),
        ]);

        $pesan = app(WhatsAppService::class)->sendTextMessage('6285725116817', 'Uji nomor terdaftar');

        $this->assertSame('sent', $pesan->status);
        $this->assertNull($pesan->error_reason);
    }

    public function test_endpoint_tidak_tersedia_kirim_tetap_jalan(): void
    {
        Http::fake([
            '*/api/on-whatsapp' => Http::response([], 404),
            '*' => Http::response(['id' => 'WA-3'], 200),
        ]);

        $pesan = app(WhatsAppService::class)->sendTextMessage('6285725116817', 'Uji fail-open');

        $this->assertSame('sent', $pesan->status);
    }
}
