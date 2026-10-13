<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AnnouncementSlideSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Setelan slide bar promo dipakai storefront dalam satuan detik dan boleh
 * pecahan: rotasi storefront punya lantai 2,5 detik (announcement-bar.tsx).
 * Nilai bawaan setelan ini juga 2,5. Dulu validasinya menuntut bilangan bulat
 * minimal 2, sehingga nilai bawaan 2,5 ditolak form (input number menganggapnya
 * tidak valid) dan tombol Simpan diam tanpa pesan. Test ini mengunci domain
 * barunya: pecahan dari 2,5 sampai 30 detik.
 */
class AnnouncementSlideSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_interval_pecahan_nilai_bawaan_diterima_dan_tersimpan(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.slide'), ['enabled' => true, 'interval' => 2.5])
            ->assertRedirect(route('admin.announcements.index'))
            ->assertSessionHasNoErrors();

        $this->assertSame(2.5, AnnouncementSlideSettings::get()['interval']);
    }

    public function test_interval_di_luar_rentang_ditolak(): void
    {
        foreach ([1, 31] as $nilai) {
            $this->actingAs($this->admin())
                ->post(route('admin.announcements.slide'), ['enabled' => true, 'interval' => $nilai])
                ->assertSessionHasErrors('interval');
        }
    }

    public function test_interval_bukan_angka_ditolak(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.slide'), ['enabled' => true, 'interval' => 'cepat'])
            ->assertSessionHasErrors('interval');
    }
}
