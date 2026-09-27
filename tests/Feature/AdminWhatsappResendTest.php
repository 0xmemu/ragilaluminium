<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\WhatsAppMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Kirim ulang pesan WhatsApp yang gagal dari halaman detail pesanan
 * (permintaan owner 2026-09-27).
 *
 * Kontrak: POST admin.orders.whatsapp.resend mengirim ulang isi persis dari
 * baris gagal lewat WhatsAppService; hasilnya dicatat sebagai baris pesan
 * BARU sehingga baris gagal tetap tersimpan sebagai riwayat. Tanpa pesan
 * gagal, tidak ada baris baru yang dibuat.
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

    private function pesanGagal(Order $order, string $teks): WhatsAppMessage
    {
        return WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $order->id,
            'phone_number' => '6285725116817',
            'provider' => 'baileys',
            'internal_template_key' => 'order_created',
            'status' => 'failed',
            'content_text' => $teks,
            'error_reason' => 'gateway down',
        ]);
    }

    public function test_kirim_ulang_mencatat_baris_baru_dan_menyimpan_riwayat_gagal(): void
    {
        Http::fake(['*' => Http::response(['id' => 'WA-RESEND-1'], 200)]);

        $order = $this->order();
        $this->pesanGagal($order, 'Pesan pertama gagal');
        $this->pesanGagal($order, 'Pesan kedua gagal');
        $jumlahAwal = WhatsAppMessage::count();

        $response = $this->actingAs($this->admin())
            ->post(route('admin.orders.whatsapp.resend', $order));

        $response->assertRedirect();
        $this->assertSame($jumlahAwal + 2, WhatsAppMessage::count());

        // Baris gagal tetap tersimpan sebagai riwayat percobaan.
        $this->assertSame(2, WhatsAppMessage::where('status', 'failed')->count());

        // Dua baris baru berisi naskah persis dari baris gagal, statusnya bukan gagal.
        $baru = WhatsAppMessage::where('internal_template_key', 'free_form')->get();
        $this->assertSame(2, $baru->count());
        $this->assertTrue($baru->pluck('content_text')->contains('Pesan pertama gagal'));
        $this->assertTrue($baru->pluck('content_text')->contains('Pesan kedua gagal'));
        $this->assertSame(0, $baru->where('status', 'failed')->count());
    }

    public function test_tanpa_pesan_gagal_tidak_membuat_baris_baru(): void
    {
        $order = $this->order();
        $jumlahAwal = WhatsAppMessage::count();

        $response = $this->actingAs($this->admin())
            ->post(route('admin.orders.whatsapp.resend', $order));

        $response->assertRedirect();
        $this->assertSame($jumlahAwal, WhatsAppMessage::count());
    }
}
