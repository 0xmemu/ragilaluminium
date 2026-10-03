<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Tombol Kembali di Media Library HANYA muncul bila halaman itu dibuka dari
 * halaman Produk (tautan di sana membawa `origin=products`).
 *
 * Riwayat kontraknya: dulu Media Library tidak punya tombol Kembali sama sekali
 * walau dibuka dari halaman Produk; lalu tombolnya dipasang tanpa syarat,
 * sehingga muncul juga saat halaman dibuka langsung dari sidebar. Owner
 * 2026-09-30 meminta syarat itu dikembalikan: langsung dari sidebar tidak
 * perlu tombol, karena tidak ada tujuan kembali yang wajar.
 *
 * Riwayat Media tetap SELALU punya tombol Kembali ke Media Library, karena ia
 * memang anak halaman itu (lihat daftar active pada config/admin-sitemap.php).
 */
class AdminMediaBackButtonTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_media_library_tanpa_penanda_asal_tidak_memakai_tombol_kembali(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.library'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/Library')
                ->where('backUrl', null)
                ->where('origin', null));
    }

    public function test_media_library_dari_halaman_produk_punya_tombol_kembali(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.library', ['origin' => 'products']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/Library')
                ->where('backUrl', route('admin.products.index'))
                ->where('origin', 'products'));
    }

    public function test_penanda_asal_terbawa_ke_tautan_riwayat_media(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.library', ['origin' => 'products']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('historyHref', route('admin.media.history', ['origin' => 'products'])));
    }

    public function test_tautan_media_dari_halaman_produk_membawa_penanda_asal(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('mediaHref', route('admin.media.library', ['origin' => 'products'])));
    }

    public function test_riwayat_media_selalu_punya_tombol_kembali_ke_media_library(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.history'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/History')
                ->where('backUrl', route('admin.media.library')));
    }

    /** Rantai asal tidak putus: Riwayat Media meneruskan penanda ke Media Library. */
    public function test_riwayat_media_meneruskan_penanda_asal(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.history', ['origin' => 'products']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('backUrl', route('admin.media.library', ['origin' => 'products'])));
    }
}
