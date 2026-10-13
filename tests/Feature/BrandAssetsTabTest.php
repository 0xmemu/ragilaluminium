<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Aset brand (logo + favicon) dikelola dari Profil & Kontak Toko.
 *
 * Riwayat penempatannya: dulu uploader brand nyempil di halaman Impor dalam
 * <details> terlipat yang mudah terlewat, lalu sempat menjadi tab "Aset
 * Brand". Sejak owner 2026-09-29 meminta satu view tanpa tab, aset brand
 * tampil di halaman yang sama bersama tautan dan kontak.
 */
class BrandAssetsTabTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_halaman_profil_menyajikan_aset_brand_dalam_satu_view(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.store-settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/StorefrontPlatforms/Edit')
                // Kontrak satu view: prop `tab` dan `tabs` sudah tidak dipakai
                // untuk memilih seksi, karena ketiga seksi selalu tampil.
                ->missing('tab')
                ->missing('tabs')
                ->has('brandAssets')
                ->has('brandSubmitUrl')
                ->has('platforms')
                ->has('kontakFields')
            );
    }

    public function test_data_brand_menyertakan_berkas_nyata(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.store-settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('brandAssets.logo.path', 'images/brand/light-logo.png')
                ->where('brandAssets.faviconIco.path', 'images/site-favicon.ico')
            );
    }

    public function test_kedua_url_halaman_profil_menampilkan_view_yang_sama(): void
    {
        // Dua pintu masuk ini menampilkan komponen yang sama; penggabungan tab
        // tidak boleh membuat salah satunya kehilangan data.
        foreach ([
            route('admin.store-settings.index'),
            route('admin.storefront-platforms.edit'),
        ] as $url) {
            $this->actingAs($this->admin())
                ->get($url)
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->component('Admin/StorefrontPlatforms/Edit')
                    ->has('brandAssets')
                    ->has('platforms')
                    ->has('kontakFields')
                );
        }
    }
}
