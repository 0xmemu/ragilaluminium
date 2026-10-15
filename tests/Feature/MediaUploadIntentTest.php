<?php

namespace Tests\Feature;

use App\Models\MediaUploadIntent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Jejak niat unggah media (owner 2026-10-15).
 *
 * Alasannya: dulu fase antara admin menekan "Mulai Unggah" dan berkas diterima
 * server tidak tercatat sama sekali. Akibatnya, menutup tab di tengah unggahan
 * menghilangkan keterangan berkas mana yang belum masuk tanpa sisa. Sekarang
 * klien mencatat NIAT lebih dulu, dan penyapu `media:close-stale-intents`
 * menandainya terputus kalau tidak ada kabar sampai batas waktu.
 *
 * Yang dijaga di sini: bentuk pencatatannya (satu baris per berkas), siapa yang
 * boleh membuang catatan, dan perilaku penyapunya.
 */
class MediaUploadIntentTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function berkas(string $nama, string $sidik = null): array
    {
        return [
            'name' => $nama,
            'size_bytes' => 1024,
            'checksum' => $sidik ?? hash('sha256', $nama),
        ];
    }

    public function test_mencatat_satu_baris_per_berkas(): void
    {
        $user = $this->admin();

        $res = $this->actingAs($user)->postJson(route('admin.media.upload-intents'), [
            'client_batch_id' => 'batch-uji-1',
            'files' => [$this->berkas('a.jpg'), $this->berkas('b.jpg'), $this->berkas('c.jpg')],
        ]);

        $res->assertStatus(201);
        $ids = $res->json('intent_ids');
        $this->assertCount(3, $ids);

        $this->assertSame(3, MediaUploadIntent::where('user_id', $user->id)->count());
        $this->assertSame(
            ['uploading'],
            MediaUploadIntent::query()->distinct()->pluck('status')->all(),
        );
        $this->assertSame('batch-uji-1', MediaUploadIntent::first()->client_batch_id);
    }

    public function test_menolak_sidik_jari_yang_tidak_sah(): void
    {
        $this->actingAs($this->admin())
            ->postJson(route('admin.media.upload-intents'), [
                'client_batch_id' => 'batch-uji-2',
                'files' => [$this->berkas('a.jpg', 'bukan-hex')],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('files.0.checksum');

        $this->assertSame(0, MediaUploadIntent::count());
    }

    public function test_membuang_hanya_catatan_milik_sendiri(): void
    {
        $pemilik = $this->admin();
        $lain = $this->admin();

        $milikSendiri = MediaUploadIntent::create([
            'user_id' => $pemilik->id,
            'client_batch_id' => 'b1',
            'file_name' => 'punyaku.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_FAILED,
        ]);
        $milikLain = MediaUploadIntent::create([
            'user_id' => $lain->id,
            'client_batch_id' => 'b2',
            'file_name' => 'punya-orang.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_FAILED,
        ]);

        $this->actingAs($pemilik)
            ->postJson(route('admin.media.upload-intents.dismiss'), [
                'ids' => [$milikSendiri->id, $milikLain->id],
            ])
            ->assertOk()
            ->assertJson(['deleted' => 1]);

        $this->assertNull(MediaUploadIntent::find($milikSendiri->id));
        $this->assertNotNull(MediaUploadIntent::find($milikLain->id));
    }

    public function test_penyapu_menandai_niat_menggantung_terputus(): void
    {
        $user = $this->admin();

        DB::table('media_upload_intents')->insert([
            [
                'user_id' => $user->id,
                'client_batch_id' => 'lama',
                'file_name' => 'menggantung.jpg',
                'size_bytes' => 10,
                'status' => MediaUploadIntent::STATUS_UPLOADING,
                'created_at' => now()->subMinutes(90),
                'updated_at' => now()->subMinutes(90),
            ],
            [
                'user_id' => $user->id,
                'client_batch_id' => 'baru',
                'file_name' => 'masih-jalan.jpg',
                'size_bytes' => 10,
                'status' => MediaUploadIntent::STATUS_UPLOADING,
                'created_at' => now()->subMinutes(1),
                'updated_at' => now()->subMinutes(1),
            ],
        ]);

        $this->artisan('media:close-stale-intents', ['--minutes' => 30])->assertSuccessful();

        $this->assertSame(
            MediaUploadIntent::STATUS_DISCONNECTED,
            MediaUploadIntent::where('file_name', 'menggantung.jpg')->value('status'),
        );
        $this->assertSame(
            MediaUploadIntent::STATUS_UPLOADING,
            MediaUploadIntent::where('file_name', 'masih-jalan.jpg')->value('status'),
        );
    }

    public function test_penyapu_memangkas_catatan_kedaluwarsa(): void
    {
        $user = $this->admin();

        DB::table('media_upload_intents')->insert([
            'user_id' => $user->id,
            'client_batch_id' => 'tua',
            'file_name' => 'kedaluwarsa.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_DONE,
            'created_at' => now()->subDays(40),
            'updated_at' => now()->subDays(40),
        ]);

        $this->artisan('media:close-stale-intents', ['--retention-days' => 14])->assertSuccessful();

        $this->assertSame(0, MediaUploadIntent::count());
    }

    public function test_dry_run_tidak_mengubah_apa_pun(): void
    {
        $user = $this->admin();

        DB::table('media_upload_intents')->insert([
            'user_id' => $user->id,
            'client_batch_id' => 'lama',
            'file_name' => 'menggantung.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_UPLOADING,
            'created_at' => now()->subMinutes(90),
            'updated_at' => now()->subMinutes(90),
        ]);

        $this->artisan('media:close-stale-intents', ['--minutes' => 30, '--dry-run' => true])
            ->assertSuccessful();

        $this->assertSame(
            MediaUploadIntent::STATUS_UPLOADING,
            MediaUploadIntent::where('file_name', 'menggantung.jpg')->value('status'),
        );
    }

    public function test_halaman_pustaka_membawa_niat_yang_belum_selesai(): void
    {
        $user = $this->admin();

        foreach (['gagal.jpg', 'terputus.jpg'] as $nama) {
            MediaUploadIntent::create([
                'user_id' => $user->id,
                'client_batch_id' => 'b',
                'file_name' => $nama,
                'size_bytes' => 10,
                'status' => $nama === 'gagal.jpg'
                    ? MediaUploadIntent::STATUS_FAILED
                    : MediaUploadIntent::STATUS_DISCONNECTED,
            ]);
        }

        // Baris yang masih berjalan dan yang sudah selesai TIDAK boleh muncul:
        // keduanya bukan berkas yang perlu diunggah ulang.
        MediaUploadIntent::create([
            'user_id' => $user->id,
            'client_batch_id' => 'b',
            'file_name' => 'masih-jalan.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_UPLOADING,
        ]);
        MediaUploadIntent::create([
            'user_id' => $user->id,
            'client_batch_id' => 'b',
            'file_name' => 'sudah-masuk.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_DONE,
        ]);

        $this->actingAs($user)
            ->get(route('admin.media.library'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/Library')
                ->has('uploadIntents', 2)
                ->where('uploadIntents.0.file_name', 'terputus.jpg')
                ->where('uploadIntents.1.file_name', 'gagal.jpg'));
    }

    public function test_niat_milik_pengguna_lain_tidak_ikut_tampil(): void
    {
        $saya = $this->admin();
        $lain = $this->admin();

        MediaUploadIntent::create([
            'user_id' => $lain->id,
            'client_batch_id' => 'b',
            'file_name' => 'punya-orang.jpg',
            'size_bytes' => 10,
            'status' => MediaUploadIntent::STATUS_FAILED,
        ]);

        $this->actingAs($saya)
            ->get(route('admin.media.library'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/Library')
                ->has('uploadIntents', 0));
    }
}
