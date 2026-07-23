<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\CaraPemesananSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CaraPemesananAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_edit_and_public_page_uses_cms_guide(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.cara-pemesanan.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CaraPemesanan/Edit')
                ->has('page.steps')
                ->where('page.heading', CaraPemesananSettings::DEFAULT_HEADING));

        $this->actingAs($admin)
            ->put(route('admin.cara-pemesanan.update'), [
                'title' => 'Cara Pemesanan',
                'published' => true,
                'heading' => 'Pesan aluminium dengan mudah',
                'subtitle' => 'Empat langkah singkat',
                'body' => "<p>Catatan custom ukuran wajib.</p>",
                'steps' => [
                    [
                        'icon' => 'search',
                        'title' => 'Pilih katalog',
                        'description' => 'Mulai dari model jendela',
                        'points' => ["Filter kategori", "Cek foto"],
                    ],
                    [
                        'icon' => 'truck',
                        'title' => 'Tunggu pengiriman',
                        'description' => 'Kami kirim ke alamat Anda',
                        'points' => ['Lacak di menu Pesanan'],
                    ],
                ],
                'info_cards' => [
                    [
                        'icon' => 'credit-card',
                        'title' => 'Bayar fleksibel',
                        'description' => 'COD atau transfer',
                    ],
                ],
            ])
            ->assertRedirect(route('admin.cara-pemesanan.edit'));

        $page = CmsPage::query()->where('slug', 'cara-pemesanan')->first();
        $this->assertNotNull($page);
        $this->assertSame('Pesan aluminium dengan mudah', $page->content['heading']);
        $this->assertSame('Pilih katalog', $page->content['steps'][0]['title']);
        $this->assertSame(['Filter kategori', 'Cek foto'], $page->content['steps'][0]['points']);

        $this->get(route('cara-pemesanan'))
            ->assertOk()
            ->assertInertia(fn (Assert $assert) => $assert
                ->component('Public/HowToOrder')
                ->where('guide.heading', 'Pesan aluminium dengan mudah')
                ->where('guide.steps.0.title', 'Pilih katalog')
                ->where('guide.info_cards.0.title', 'Bayar fleksibel')
                ->where('guide.body_html', '<p>Catatan custom ukuran wajib.</p>'));
    }
}
