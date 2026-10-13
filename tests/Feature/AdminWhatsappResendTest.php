<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\WhatsAppMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Kirim ulang pesan perubahan status yang gagal (owner 2026-09-27).
 *
 * Kontrak:
 * - Tombol hanya menyasar pesan PERUBAHAN STATUS (kunci templat resmi) yang
 *   gagal segar (dalam 24 jam). Gagal lama dan templat non-status diabaikan.
 * - Satu notifikasi yang gagal berkali-kali tetap dikirim ulang SEKALI
 *   (percobaan terbaru); percobaan lain ditandai digantikan lewat
 *   raw_payload.superseded_by supaya tidak terkirim ganda dan tidak dihitung.
 * - Pengiriman ulang memperbarui status baris yang sama, tidak membuat baris
 *   baru.
 */
class AdminWhatsappResendTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function order(): Order
    {
        return Order::create([
            'order_number' => 'RA-WAR-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '085725116817',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'return_in_process',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
    }

    private function pesanGagal(Order $order, string $teks, string $kunci = 'order_created'): WhatsAppMessage
    {
        return WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $order->id,
            'phone_number' => '6285725116817',
            'provider' => 'baileys',
            'internal_template_key' => $kunci,
            'status' => 'failed',
            'content_text' => $teks,
            'error_reason' => 'gateway down',
        ]);
    }

    public function test_notifikasi_dengan_beberapa_percobaan_dikirim_ulang_sekali(): void
    {
        Http::fake(['*' => Http::response(['id' => 'WA-RESEND-1'], 200)]);

        $order = $this->order();
        $a = $this->pesanGagal($order, 'Percobaan pertama gagal');
        $b = $this->pesanGagal($order, 'Percobaan kedua gagal');
        $c = $this->pesanGagal($order, 'Percobaan ketiga gagal');
        $jumlahAwal = WhatsAppMessage::count();

        $response = $this->actingAs($this->admin())
            ->post(route('admin.orders.whatsapp.resend', $order));

        $response->assertRedirect();

        // Tidak ada baris baru yang dibuat.
        $this->assertSame($jumlahAwal, WhatsAppMessage::count());

        // Percobaan terbaru terkirim; dua percobaan lain gagal tercatat
        // digantikan sehingga tidak ikut dikirim dan tidak dihitung.
        $terbaru = $c->fresh();
        $this->assertSame('sent', $terbaru->status);
        $this->assertSame($terbaru->id, $b->fresh()->raw_payload['superseded_by']);
        $this->assertSame($terbaru->id, $a->fresh()->raw_payload['superseded_by']);

        // Tidak ada lagi notifikasi status yang tersisa untuk dikirim ulang.
        $sisa = WhatsAppMessage::query()
            ->where('status', 'failed')
            ->whereNull('raw_payload->superseded_by')
            ->whereIn('internal_template_key', app(\App\Services\WhatsAppService::class)->statusTemplateKeys())
            ->count();
        $this->assertSame(0, $sisa);
    }

    public function test_gagal_lama_dan_bukan_templat_status_diabaikan(): void
    {
        Http::fake(['*' => Http::response(['id' => 'WA-RESEND-2'], 200)]);

        $order = $this->order();
        $lama = $this->pesanGagal($order, 'Pesan lama gagal');
        $lama->created_at = now()->subDays(3);
        $lama->save();
        $bukanStatus = $this->pesanGagal($order, 'Pesan non-status gagal', 'wa_balasan_ulasan');
        $jumlahAwal = WhatsAppMessage::count();

        $response = $this->actingAs($this->admin())
            ->post(route('admin.orders.whatsapp.resend', $order));

        $response->assertRedirect();
        $this->assertSame($jumlahAwal, WhatsAppMessage::count());
        $this->assertSame('failed', $lama->fresh()->status);
        $this->assertSame('failed', $bukanStatus->fresh()->status);
        $this->assertNull($bukanStatus->fresh()->raw_payload['superseded_by'] ?? null);
    }

    public function test_tanpa_pesan_gagal_tidak_mengubah_data(): void
    {
        $order = $this->order();
        $jumlahAwal = WhatsAppMessage::count();

        $response = $this->actingAs($this->admin())
            ->post(route('admin.orders.whatsapp.resend', $order));

        $response->assertRedirect();
        $this->assertSame($jumlahAwal, WhatsAppMessage::count());
    }
}
