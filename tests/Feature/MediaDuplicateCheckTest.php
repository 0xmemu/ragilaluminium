<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pemeriksaan duplikat berkas sebelum unggah (kontrak owner 2026-10-08).
 *
 * Endpoint ini dipakai klien untuk memperingatkan admin SEBELUM berkas dikirim,
 * supaya berkas identik tidak terkirim sama sekali. Yang dijaga di sini: aset
 * aktif dilaporkan, aset arsip TIDAK dilaporkan karena berkasnya sudah dihapus
 * dan mengunggahnya lagi justru wajar, dan bentuk sidik jarinya divalidasi.
 */
class MediaDuplicateCheckTest extends TestCase
{
    use RefreshDatabase;

    private const SIDIK_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    private const SIDIK_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    /** @param  array<string, mixed>  $atribut */
    private function aset(array $atribut = []): MediaAsset
    {
        return MediaAsset::create(array_merge([
            'kind' => 'image',
            'label' => 'aset.png',
            'object_key' => 'k/aset.png',
            'mime_type' => 'image/png',
            'size_bytes' => 1,
            'status' => 'ready',
            'visibility' => 'visible',
        ], $atribut));
    }

    public function test_melaporkan_aset_aktif_yang_sidik_jarinya_sama(): void
    {
        $this->aset(['label' => 'banner_4_20260910.png', 'checksum' => self::SIDIK_A]);

        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), ['checksums' => [self::SIDIK_A]])
            ->assertOk()
            ->assertJsonPath('duplicates.'.self::SIDIK_A.'.label', 'banner_4_20260910.png')
            ->assertJsonPath('duplicates.'.self::SIDIK_A.'.kind', 'image')
            ->assertJsonPath('duplicates.'.self::SIDIK_A.'.status', 'ready')
            ->assertJsonPath('duplicates.'.self::SIDIK_A.'.usage_count', 0);
    }

    public function test_tidak_melaporkan_aset_yang_sudah_diarsipkan(): void
    {
        // Aset arsip tidak lagi tayang dan berkasnya sudah dihapus dari
        // penyimpanan, jadi mengunggah berkas yang sama justru wajar.
        $this->aset(['label' => 'lama.png', 'checksum' => self::SIDIK_A, 'status' => 'archived']);

        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), ['checksums' => [self::SIDIK_A]])
            ->assertOk()
            ->assertJsonPath('duplicates', []);
    }

    public function test_tidak_melaporkan_sidik_jari_yang_belum_ada(): void
    {
        $this->aset(['checksum' => self::SIDIK_A]);

        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), ['checksums' => [self::SIDIK_B]])
            ->assertOk()
            ->assertJsonPath('duplicates', []);
    }

    public function test_checksum_kosong_tidak_pernah_dianggap_duplikat(): void
    {
        // Upload langsung tidak mengisi checksum, jadi aset ber-checksum kosong
        // tidak boleh dianggap kembar oleh permintaan apa pun.
        $this->aset(['checksum' => '']);

        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), ['checksums' => [self::SIDIK_A]])
            ->assertOk()
            ->assertJsonPath('duplicates', []);
    }

    public function test_menolak_sidik_jari_yang_bukan_heksadesimal_sha256(): void
    {
        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), ['checksums' => ['bukan-sidik-jari']])
            ->assertStatus(422);
    }

    public function test_menolak_permintaan_tanpa_checksums(): void
    {
        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), [])
            ->assertStatus(422);
    }

    public function test_menolak_jumlah_sidik_jari_di_atas_batas(): void
    {
        $this->actingAs($this->admin())
            ->postJson(route('admin.media.check-duplicates'), [
                'checksums' => array_map(
                    fn (int $i) => str_pad((string) $i, 64, '0', STR_PAD_LEFT),
                    range(1, 51),
                ),
            ])
            ->assertStatus(422);
    }

    public function test_tamu_tidak_bisa_memakainya(): void
    {
        $this->postJson(route('admin.media.check-duplicates'), ['checksums' => [self::SIDIK_A]])
            ->assertStatus(401);
    }
}
