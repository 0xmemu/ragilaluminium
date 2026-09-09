<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\AboutPageSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TentangKamiAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_edit_tentang_kami_structured_content_and_public_about_renders_it(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Form terstruktur (bukan textarea HTML).
        $this->actingAs($admin)
            ->get(route('admin.tentang-kami.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/TentangKami/Edit')
                ->has('page.hero_title')
                ->has('page.hero_tagline')
                ->has('page.why_points')
                ->has('page.work_steps')
                ->has('page.trust_rows')
                ->has('iconOptions'));

        // Simpan konten terstruktur.
        $this->actingAs($admin)
            ->put(route('admin.tentang-kami.update'), [
                'hero_title' => 'Tentang Ragil Aluminium',
                'hero_tagline' => 'Workshop aluminium untuk rumah dan proyek.',
                'why_points' => [
                    ['icon' => 'storefront', 'title' => 'Produksi sendiri', 'body' => 'Kontrol kualitas langsung.'],
                    ['icon' => 'ruler', 'title' => 'Bisa custom', 'body' => 'Ukuran sesuai kebutuhan proyek.'],
                ],
                'work_steps' => [
                    ['title' => 'Konsultasi', 'body' => 'Tentukan model dan ukuran.'],
                    ['title' => 'Produksi', 'body' => 'Pemeriksaan kualitas ketat.'],
                ],
                'trust_rows' => ['Pengiriman seluruh Indonesia', 'Garansi pemasangan'],
            ])
            ->assertRedirect(route('admin.tentang-kami.edit'));

        $page = CmsPage::query()->where('slug', AboutPageSettings::PAGE_SLUG)->first();
        $this->assertNotNull($page);
        $this->assertSame('Workshop aluminium untuk rumah dan proyek.', $page->content['hero_tagline']);
        $this->assertCount(2, $page->content['why_points']);
        $this->assertCount(2, $page->content['work_steps']);

        // Halaman publik merender konten terstruktur, style tetap dari komponen.
        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn (Assert $assert) => $assert
                ->component('Public/About')
                ->where('page.heading', 'Tentang Ragil Aluminium')
                ->where('page.tagline', 'Workshop aluminium untuk rumah dan proyek.')
                ->where('page.why_points.0.title', 'Produksi sendiri')
                ->where('page.work_steps.1.title', 'Produksi')
                ->where('page.trust_rows.0', 'Pengiriman seluruh Indonesia'));
    }

    public function test_empty_about_content_falls_back_to_defaults(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Simpan hanya judul; sisanya kosong.
        $this->actingAs($admin)
            ->put(route('admin.tentang-kami.update'), [
                'hero_title' => 'Tentang Kami',
                'hero_tagline' => '',
                'why_points' => [
                    ['icon' => 'check-circle', 'title' => '', 'body' => ''],
                ],
                'work_steps' => [
                    ['title' => '', 'body' => ''],
                ],
                'trust_rows' => [],
            ])
            ->assertRedirect(route('admin.tentang-kami.edit'));

        // Baris judul kosong diabaikan (bukan error) dan storefront tetap
        // mendapat konten baku via fallback.
        $storefront = AboutPageSettings::forStorefront();
        $this->assertSame('Tentang Kami', $storefront['hero_title']);
        $this->assertSame('', $storefront['hero_tagline']);
        $this->assertSame(AboutPageSettings::DEFAULT_WHY_POINTS, $storefront['why_points']);
        $this->assertSame(AboutPageSettings::DEFAULT_WORK_STEPS, $storefront['work_steps']);
        $this->assertSame(AboutPageSettings::DEFAULT_TRUST_ROWS, $storefront['trust_rows']);

        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn (Assert $assert) => $assert
                ->component('Public/About')
                ->where('page.why_points.0.title', 'Produksi sendiri'));
    }
}
