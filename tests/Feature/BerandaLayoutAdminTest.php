<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\HomepageLayoutSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BerandaLayoutAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_beranda_index_and_layout_update(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.beranda.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Beranda/Index')
                ->has('sections', 3)
                ->where('sections.0.key', 'category_menu'));

        $this->actingAs($admin)
            ->put(route('admin.beranda.update'), [
                'sections' => [
                    ['key' => 'how_to_order', 'enabled' => true, 'sort_order' => 0],
                    ['key' => 'banner', 'enabled' => false, 'sort_order' => 1],
                ],
            ])
            ->assertRedirect(route('admin.beranda.index'));

        $page = CmsPage::query()->where('slug', 'beranda')->first();
        $this->assertNotNull($page);

        // Update bersifat merge: semua SECTION_KEYS selalu hadir (default untuk yang
        // tidak dikirim), toggle banner tersimpan sesuai payload.
        $sections = collect($page->content['layout']['sections']);
        $this->assertCount(3, $sections);
        $this->assertFalse((bool) $sections->firstWhere('key', 'banner')['enabled']);
        $this->assertTrue((bool) $sections->firstWhere('key', 'category_menu')['enabled']);
        $this->assertTrue((bool) $sections->firstWhere('key', 'how_to_order')['enabled']);
    }

    public function test_admin_can_update_service_highlights_and_how_to_order(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->put(route('admin.beranda.service-highlights.update'), [
                'title' => 'Keunggulan Ragil',
                'subtitle' => 'Alasan pelanggan percaya',
                'items' => [
                    ['icon' => 'shield', 'title' => 'Garansi Resmi', 'description' => '1 tahun'],
                    ['icon' => 'cod', 'title' => 'Bisa COD', 'description' => 'Bayar ditempat'],
                ],
            ])
            ->assertRedirect(route('admin.beranda.index'));

        $this->actingAs($admin)
            ->put(route('admin.beranda.how-to-order.update'), [
                'title' => 'Cara pesan cepat',
                'subtitle' => 'Empat langkah',
                'steps' => [
                    ['title' => 'Pilih', 'description' => 'Pilih model'],
                    ['title' => 'Bayar', 'description' => 'Checkout'],
                ],
            ])
            ->assertRedirect(route('admin.beranda.index'));

        $layout = HomepageLayoutSettings::forStorefront();
        $this->assertSame('Keunggulan Ragil', $layout['service_highlights']['title']);
        $this->assertSame('Cara pesan cepat', $layout['how_to_order']['title']);
        $this->assertSame('01', $layout['how_to_order']['steps'][0]['step']);
    }

    public function test_public_home_receives_homepage_layout_props(): void
    {
        HomepageLayoutSettings::updateHowToOrder([
            'title' => 'Cara pesan dari CMS',
            'subtitle' => 'Dari admin',
            'steps' => [
                ['title' => 'Satu', 'description' => 'Langkah satu'],
            ],
        ]);

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Home')
                ->where('homepageLayout.how_to_order.title', 'Cara pesan dari CMS')
                ->has('homepageLayout.sections', 3));
    }
}
