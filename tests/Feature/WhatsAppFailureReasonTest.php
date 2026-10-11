<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WhatsAppMessage;
use App\Support\WhatsAppFailureReason;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kontrak owner 2026-10-11: alasan gagal kirim WhatsApp ditampilkan dengan
 * bahasa yang dinormalkan, bukan JSON mentah dari gateway.
 *
 * Bukti lapangan sebelum perbaikan: 23 dari 24 baris pesan gagal menyimpan
 * {"error":"not connected","status":"..."} dan teks itu tampil apa adanya di
 * kolom galat tabel pesan gagal.
 *
 * Penyimpanan tetap apa adanya untuk diagnosa; yang diuji di sini adalah
 * tampilannya (hub, notifikasi admin, dan pesan kirim ulang memakai kelas yang
 * sama).
 */
class WhatsAppFailureReasonTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /** JSON mentah gateway diterjemahkan sesuai status sambungannya. */
    public function test_payload_gateway_diterjemahkan_per_status(): void
    {
        $this->assertSame(
            'Gateway terputus dari WhatsApp, sambungkan ulang di tab Sambungkan Nomor.',
            WhatsAppFailureReason::describe('{"error":"not connected","status":"disconnected"}'),
        );

        $this->assertSame(
            'Gateway sedang menyambung ke WhatsApp, coba kirim ulang sebentar lagi.',
            WhatsAppFailureReason::describe('{"error":"not connected","status":"connecting"}'),
        );

        $this->assertSame(
            'Gateway menunggu pindai QR, buka tab Sambungkan Nomor.',
            WhatsAppFailureReason::describe('{"error":"not connected","status":"SCAN_QR"}'),
        );
    }

    /** Alasan yang sudah berbahasa Indonesia dibiarkan apa adanya. */
    public function test_alasan_yang_sudah_indonesia_dibiarkan(): void
    {
        $this->assertSame(
            'Nomor tidak terdaftar WhatsApp.',
            WhatsAppFailureReason::describe('Nomor tidak terdaftar WhatsApp.'),
        );
        $this->assertSame(
            'Provider baileys belum dikonfigurasi.',
            WhatsAppFailureReason::describe('Provider baileys belum dikonfigurasi.'),
        );
    }

    /** Galat jaringan tidak lagi tampil sebagai pesan cURL mentah. */
    public function test_galat_jaringan_diterjemahkan(): void
    {
        $this->assertSame(
            'Tidak dapat menghubungi gateway, jaringan gagal atau waktu habis.',
            WhatsAppFailureReason::describe('cURL error 28: Operation timed out after 15001 milliseconds'),
        );
    }

    public function test_alasan_kosong_tidak_menghasilkan_teks(): void
    {
        $this->assertNull(WhatsAppFailureReason::describe(null));
        $this->assertNull(WhatsAppFailureReason::describe('   '));
    }

    /** Alasan asing tetap tampil, tetapi sebagai satu baris bersih. */
    public function test_alasan_asing_dirapikan_tanpa_dump_json(): void
    {
        $hasil = WhatsAppFailureReason::describe('{"foo":"bar","baz":"qux"}');

        $this->assertNotNull($hasil);
        $this->assertStringNotContainsString('{', $hasil);
        $this->assertStringNotContainsString('"', $hasil);
    }

    /** Hub menampilkan terjemahannya, bukan JSON mentah. */
    public function test_hub_menampilkan_alasan_yang_sudah_dinormalkan(): void
    {
        WhatsAppMessage::create([
            'phone_number' => '628123456789',
            'direction' => 'outbound',
            'status' => 'failed',
            'content_text' => 'Konfirmasi pesanan',
            'error_reason' => '{"error":"not connected","status":"disconnected"}',
            'provider' => 'baileys',
        ]);

        $this->actingAs($this->admin())
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Hub')
                ->where('failed_messages.0.error', WhatsAppFailureReason::describe('{"error":"not connected","status":"disconnected"}'))
                ->where('failed_messages.0.error', 'Gateway terputus dari WhatsApp, sambungkan ulang di tab Sambungkan Nomor.'));
    }

    /** Penjaga: tidak boleh ada teks mentah gateway yang bocor ke tabel hub. */
    public function test_hub_tidak_menampilkan_json_mentah(): void
    {
        WhatsAppMessage::create([
            'phone_number' => '628123456789',
            'direction' => 'outbound',
            'status' => 'failed',
            'content_text' => 'Konfirmasi pesanan',
            'error_reason' => '{"error":"not connected","status":"SCAN_QR"}',
            'provider' => 'baileys',
        ]);

        $this->actingAs($this->admin())
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(function (Assert $page): void {
                $error = $page->toArray()['props']['failed_messages'][0]['error'] ?? '';

                $this->assertStringNotContainsString('not connected', $error);
                $this->assertStringNotContainsString('{', $error);
            });
    }
}
