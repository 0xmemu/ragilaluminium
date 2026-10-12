<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Penjaga kunci tanggal periode bar promo (owner 2026-10-13).
 *
 * `$request->validate()` hanya mengembalikan kolom yang benar-benar dikirim.
 * Kolom `starts_at` dan `ends_at` boleh kosong, jadi permintaan yang tidak
 * mengirim keduanya sama sekali tetap lolos validasi dan kuncinya tidak ikut
 * ada di hasil. Membaca kunci yang tidak ada memicu peringatan PHP yang diubah
 * Laravel menjadi error, sehingga jawabannya 500 alih-alih pesan validasi.
 *
 * Form admin selalu mengirim kedua kolom itu (kosong sebagai null), jadi celah
 * ini tidak pernah muncul dari UI dan hanya tersentuh permintaan yang dibuat
 * langsung.
 */
class AnnouncementDateKeyGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_simpan_tanpa_kolom_tanggal_tidak_gagal_500(): void
    {
        $response = $this->actingAs($this->admin())->post(route('admin.announcements.store'), [
            'text' => 'Bar promo tanpa kolom periode',
            'published' => true,
        ]);

        $response->assertRedirect(route('admin.announcements.index'));
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('announcements', ['text' => 'Bar promo tanpa kolom periode']);
    }

    public function test_ubah_tanpa_kolom_tanggal_tidak_gagal_500(): void
    {
        $row = Announcement::create([
            'text' => 'Bar promo lama',
            'published' => true,
            'sort_order' => 1,
        ]);

        $response = $this->actingAs($this->admin())->put(route('admin.announcements.update', $row), [
            'text' => 'Bar promo diubah tanpa kolom periode',
            'published' => true,
        ]);

        $response->assertRedirect(route('admin.announcements.index'));
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('announcements', [
            'id' => $row->id,
            'text' => 'Bar promo diubah tanpa kolom periode',
        ]);
    }

    public function test_urutan_tanggal_terbalik_tetap_ditolak(): void
    {
        // Penjaga kunci tidak boleh melewati pemeriksaan urutan tanggal.
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => 'Periode terbalik',
                'starts_at' => '2026-12-31',
                'ends_at' => '2026-01-01',
                'published' => true,
            ])
            ->assertSessionHasErrors('ends_at');

        $this->assertDatabaseCount('announcements', 0);
    }

    public function test_tanggal_lengkap_yang_benar_tetap_tersimpan(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => 'Periode benar',
                'starts_at' => '2026-10-13',
                'ends_at' => '2026-10-31',
                'published' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('announcements', [
            'text' => 'Periode benar',
            'ends_at' => '2026-10-31 00:00:00',
        ]);
    }
}
