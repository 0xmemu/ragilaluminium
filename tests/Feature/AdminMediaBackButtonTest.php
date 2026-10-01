<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kontrak tombol Kembali (mengikuti pola AdminPromoPagesBackButtonTest):
 * halaman yang punya induk wajib menyediakan jalan kembali selain menu sidebar.
 *
 * Media Library adalah item mandiri di grup menu Produk, jadi tombol Kembalinya
 * menuju daftar Produk. Riwayat Media berada di bawah Media Library (lihat
 * daftar active pada config/admin-sitemap.php), jadi tombol Kembalinya menuju
 * Media Library.
 */
class AdminMediaBackButtonTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_media_library_punya_tombol_kembali_ke_daftar_produk(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.library'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/Library')
                ->where('backUrl', route('admin.products.index')));
    }

    public function test_riwayat_media_punya_tombol_kembali_ke_media_library(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.history'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Media/History')
                ->where('backUrl', route('admin.media.library')));
    }
}
