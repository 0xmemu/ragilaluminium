<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Otorisasi kanal privat admin (penyelidikan label "Pembaruan langsung terputus").
 *
 * Gejala produksi 17 Okt 2026: peramban admin berhasil membentuk sambungan
 * WebSocket (nginx mencatat 101), tetapi permintaan otorisasi kanal
 * POST /broadcasting/auth SELALU dijawab 403, sehingga langganan kanal privat
 * gagal dan panel melaporkan "terputus".
 *
 * Tes ini memisahkan dua kemungkinan: otorisasi kanalnya yang salah, atau sesi
 * produksi yang tidak terkirim. Kalau tes ini LULUS, otorisasi benar dan masalahnya
 * ada di sesi/cookie produksi.
 */
class AdminBroadcastAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_terautentikasi_boleh_mendengar_kanal_operations(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $res = $this->actingAs($admin)->postJson('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-admin.operations',
        ]);

        $res->assertOk();
    }

    public function test_tamu_ditolak(): void
    {
        $res = $this->postJson('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-admin.operations',
        ]);

        $this->assertContains($res->getStatusCode(), [401, 403], 'tamu harus ditolak');
    }

    public function test_non_admin_ditolak(): void
    {
        $staff = User::factory()->create(['role' => 'staff', 'status' => 'active']);

        $res = $this->actingAs($staff)->postJson('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-admin.operations',
        ]);

        $res->assertForbidden();
    }
}
