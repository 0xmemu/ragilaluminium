<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\WhatsAppMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kirim ulang satu pesan gagal dari daftar Pesan Gagal di hub WhatsApp
 * (permintaan owner 2026-09-29).
 *
 * Kontrak:
 * - Admin memilih baris yang dia lihat, jadi TIDAK ada batas 24 jam dan tidak
 *   dibatasi kunci templat perubahan status. Batas 24 jam hanya berlaku untuk
 *   tombol borongan di detail pesanan.
 * - Percobaan kembar dari notifikasi yang sama ditandai digantikan, sehingga
 *   satu notifikasi hanya terkirim SEKALI dan pelanggan tidak menerima pesan
 *   ganda.
 * - Kirim ulang memperbarui baris yang sama, tidak membuat baris baru, dan
 *   baris yang berhasil langsung hilang dari daftar serta angka pesan gagal.
 * - Kegagalan dilaporkan apa adanya dan baris tetap tinggal di daftar.
 *
 * Nomor uji memakai 085725116817 (kontrak keras pengujian WhatsApp).
 */
class AdminWhatsappListResendTest extends TestCase
{
    use RefreshDatabase;

    private const NOMOR = '085725116817';

    private const NOMOR_NORMAL = '6285725116817';

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function order(): Order
    {
        return Order::create([
            'order_number' => 'RA-WLR-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => self::NOMOR,
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
    }

    private function pesanGagal(
        ?Order $order,
        string $teks,
        ?string $kunci = 'order_created',
        string $arah = 'outbound',
    ): WhatsAppMessage {
        return WhatsAppMessage::create([
            'direction' => $arah,
            'order_id' => $order?->id,
            'phone_number' => self::NOMOR_NORMAL,
            'provider' => 'baileys',
            'internal_template_key' => $kunci,
            'status' => 'failed',
            'content_text' => $teks,
            'error_reason' => 'gateway mati',
        ]);
    }

    /** Gateway palsu: nomor dianggap terdaftar, hasil kirim ditentukan pemanggil. */
    private function fakeGateway(bool $kirimBerhasil = true, string $alasanGagal = 'gateway menolak'): void
    {
        Http::fake(function (Request $request) use ($kirimBerhasil, $alasanGagal) {
            if (str_contains($request->url(), '/api/on-whatsapp')) {
                $jid = (string) ($request->data()['numbers'][0] ?? '');

                return Http::response(['results' => [['jid' => $jid, 'exists' => true]]], 200);
            }

            return $kirimBerhasil
                ? Http::response(['id' => 'WA-LIST-1'], 200)
                : Http::response($alasanGagal, 500);
        });
    }

    public function test_kirim_ulang_dari_daftar_membuat_baris_hilang(): void
    {
        $this->fakeGateway();
        $order = $this->order();
        $pesan = $this->pesanGagal($order, 'Naskah percobaan pertama');
        $jumlahAwal = WhatsAppMessage::count();

        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $pesan))
            ->assertRedirect()
            ->assertSessionHas('success');

        // Baris yang sama diperbarui, bukan ditambah baris baru.
        $this->assertSame($jumlahAwal, WhatsAppMessage::count());
        $this->assertSame('sent', $pesan->fresh()->status);
        $this->assertNull($pesan->fresh()->error_reason);

        // Daftar dan angkanya ikut bersih.
        $this->actingAs($this->admin())
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('failed_count', 0)
                ->has('failed_messages', 0)
            );
    }

    public function test_percobaan_kembar_ditandai_digantikan_sehingga_tidak_terkirim_ganda(): void
    {
        $this->fakeGateway();
        $order = $this->order();
        $lama = $this->pesanGagal($order, 'Percobaan pertama gagal');
        $baru = $this->pesanGagal($order, 'Percobaan kedua gagal');

        // Admin menekan baris yang lebih lama; yang dikirim baris itu saja.
        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $lama))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('sent', $lama->fresh()->status);
        $this->assertSame(
            $lama->id,
            $baru->fresh()->raw_payload['superseded_by'] ?? null,
            'Percobaan kembar wajib ditandai digantikan agar tidak ikut terkirim.',
        );

        // Dua baris hilang sekaligus: satu terkirim, satu digantikan.
        $this->actingAs($this->admin())
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('failed_count', 0)
                ->has('failed_messages', 0)
            );
    }

    public function test_pesan_manual_tidak_menyentuh_baris_lain(): void
    {
        $this->fakeGateway();
        $order = $this->order();
        $pertama = $this->pesanGagal($order, 'Balasan manual pertama', null);
        $kedua = $this->pesanGagal($order, 'Balasan manual kedua', null);

        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $pertama))
            ->assertRedirect();

        $this->assertSame('sent', $pertama->fresh()->status);
        // Pesan manual tidak punya kelompok, jadi baris lain tidak boleh disentuh.
        $this->assertSame('failed', $kedua->fresh()->status);
        $this->assertNull($kedua->fresh()->raw_payload['superseded_by'] ?? null);
    }

    public function test_pesan_masuk_atau_tanpa_naskah_ditolak_tanpa_mengubah_apa_pun(): void
    {
        $this->fakeGateway();
        $order = $this->order();
        $masuk = $this->pesanGagal($order, 'Pesan pelanggan', 'order_created', 'inbound');
        $kosong = $this->pesanGagal($order, '   ');

        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $masuk))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $kosong))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame('failed', $masuk->fresh()->status);
        $this->assertSame('failed', $kosong->fresh()->status);
    }

    public function test_gagal_kirim_ulang_melaporkan_alasan_dan_baris_tetap_tinggal(): void
    {
        $this->fakeGateway(false, 'sesi WhatsApp terputus');
        $order = $this->order();
        $pesan = $this->pesanGagal($order, 'Naskah percobaan');

        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $pesan))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame('failed', $pesan->fresh()->status);
        $this->assertStringContainsString('sesi WhatsApp terputus', (string) $pesan->fresh()->error_reason);

        // Baris tetap ada di daftar supaya admin bisa mencoba lagi.
        $this->actingAs($this->admin())
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('failed_count', 1)
                ->has('failed_messages', 1)
                ->where('failed_messages.0.can_resend', true)
            );
    }

    public function test_gagal_lama_tetap_bisa_dikirim_ulang_karena_admin_memilih_sendiri(): void
    {
        // Beda dari tombol borongan di detail pesanan yang dibatasi 24 jam:
        // di daftar ini admin memilih barisnya sendiri, jadi umur tidak relevan.
        $this->fakeGateway();
        $order = $this->order();
        $lama = $this->pesanGagal($order, 'Gagal berumur tiga hari');
        $lama->forceFill(['created_at' => now()->subDays(3)])->save();

        $this->actingAs($this->admin())
            ->post(route('admin.whatsapp.messages.resend', $lama))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('sent', $lama->fresh()->status);
    }
}
