<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kontrak owner 2026-09-30: halaman anak menu Promo Toko wajib punya tombol
 * Kembali menuju halaman induknya (Promo Toko), karena kelima halaman itu
 * dibuka dari menu yang sama dan tidak ada jalan kembali selain menu sidebar.
 *
 * Halaman induk (Promo Toko sendiri) TIDAK boleh punya tombol Kembali: tidak
 * ada tujuan di atasnya, dan tombol yang mengarah ke dirinya sendiri hanya
 * membingungkan.
 */
class AdminPromoPagesBackButtonTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_halaman_anak_menu_promo_punya_tombol_kembali_ke_promo_toko(): void
    {
        $admin = $this->admin();
        $tujuan = route('admin.promotions.index');

        $halaman = [
            'banner promo' => route('admin.banners.index'),
            'bar promo' => route('admin.announcements.index'),
            'voucher toko' => route('admin.vouchers.index'),
            'daftar flash sale' => route('admin.promotions.index', ['type' => 'flash_sale']),
            'daftar diskon reguler' => route('admin.promotions.index', ['type' => 'store']),
        ];

        foreach ($halaman as $nama => $url) {
            $this->actingAs($admin)
                ->get($url)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page->where('backUrl', $tujuan), $nama);
        }
    }

    public function test_halaman_induk_promo_toko_tidak_punya_tombol_kembali(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.promotions.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/PromotionOverview')
                // Properti tidak dikirim sama sekali, bukan sekadar bernilai null.
                ->missing('backUrl'));
    }
}
