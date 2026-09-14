<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Aset brand (logo + favicon) dikelola dari Profil & Kontak Toko.
 *
 * Sebelumnya uploader brand nyempil di halaman Impor dalam <details> terlipat
 * yang mudah terlewat. Sekarang menjadi tab "Aset Brand" pada halaman yang
 * memang mengelola identitas toko.
 */
class BrandAssetsTabTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_halaman_profil_memuat_tab_aset_brand(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.store-settings.index', ['tab' => 'brand']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/StorefrontPlatforms/Edit')
                ->where('tab', 'brand')
                ->has('tabs', 3)
                ->where('tabs.2.key', 'brand')
                ->where('tabs.2.label', 'Aset Brand')
                ->has('brandAssets')
                ->has('brandSubmitUrl')
            );
    }

    public function test_data_brand_menyertakan_berkas_nyata(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.store-settings.index', ['tab' => 'brand']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('brandAssets.logo.path', 'images/brand/light-logo.png')
                ->where('brandAssets.faviconIco.path', 'images/site-favicon.ico')
            );
    }

    public function test_tab_brand_tampil_dengan_url_tanpa_param(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.store-settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('tab', 'marketplace'));
    }

    public function test_param_tab_asingjatuh_ke_marketplace(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.store-settings.index', ['tab' => 'aneh']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('tab', 'marketplace'));
    }
}
