<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\AboutPageSettings;
use App\Support\StoreContactSettings;
use App\Support\StorefrontPlatformSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TentangKamiAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_admin_can_view_tentang_kami_edit_page(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.tentang-kami.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/TentangKami/Edit')
                ->has('page')
                ->has('contact')
                ->has('platforms')
                ->has('iconOptions')
                ->where('page.hero_title', 'Jendela Ragil Aluminium'));
    }

    public function test_admin_can_update_profile_and_sync_contacts_and_platforms(): void
    {
        $admin = $this->admin();

        $payload = [
            'hero_title' => 'CV Ragil Aluminium Mandiri',
            'hero_subtitle' => 'Sejak 2008 Berkarya',
            'hero_headline' => 'Produsen Jendela & Pintu Aluminium Terbaik di Jawa Tengah',
            'hero_description' => 'Kami mengutamakan kepuasan pelanggan dengan material aluminium tebal berkualitas.',
            'main_image_url' => 'https://cdn.example.com/workshop-main.jpg',
            'gallery_items' => [
                ['url' => 'https://cdn.example.com/w1.jpg', 'title' => 'Mesin Potong', 'caption' => 'Potong presisi sudut 45 derajat'],
                ['url' => 'https://cdn.example.com/w2.jpg', 'title' => 'Area Perakitan', 'caption' => 'Perakitan kusen dan kaca'],
            ],
            'stats_items' => [
                ['value' => '16+', 'label' => 'Tahun Melayani', 'description' => 'Sejak 2008'],
                ['value' => '50.000+', 'label' => 'Unit Diproduksi', 'description' => 'Seluruh Indonesia'],
            ],
            'why_points' => [
                ['icon' => 'storefront', 'title' => 'Pabrik Sendiri', 'body' => 'Bukan perantara atau makelar.'],
                ['icon' => 'shield-check', 'title' => 'Garansi 100%', 'body' => 'Penggantian jika cacat produksi.'],
            ],
            'production_processes' => [
                ['icon' => 'storefront', 'title' => 'Pemilihan Bahan', 'description' => 'Aluminium tebal standar SNI.'],
                ['icon' => 'wrench', 'title' => 'Perakitan Handal', 'description' => 'Dikerjakan spesialis aluminium.'],
            ],
            'work_steps' => [
                ['title' => 'Pilih Model', 'body' => 'Tentukan desain jendela atau pintu.'],
                ['title' => 'Konfirmasi Admin', 'body' => 'Cek ulang ukuran dan aksesoris via WA.'],
                ['title' => 'Produksi & Kirim', 'body' => 'Dikerjakan lalu dikirim packing kayu.'],
            ],
            'trust_rows' => [
                'Bisa konsultasi ukuran khusus sebelum order',
                'Garansi ganti baru jika kaca pecah di pengiriman',
            ],
            'google_maps_url' => 'https://maps.app.goo.gl/sample123',
            'google_maps_embed_url' => 'https://www.google.com/maps/embed?pb=sample456',
            'contact' => [
                'address' => 'Jl. Raya Mandiraja No. 99, Banjarnegara',
                'phone' => '081234567899',
                'email' => 'halo@ragilaluminium.com',
                'hours' => 'Senin - Sabtu, 07.30 - 17.00 WIB',
            ],
            'platforms' => [
                'instagram' => 'https://instagram.com/ragilaluminium.official',
                'shopee' => 'https://shopee.co.id/ragilaluminium',
            ],
        ];

        $this->actingAs($admin)
            ->put(route('admin.tentang-kami.update'), $payload)
            ->assertRedirect(route('admin.tentang-kami.edit'))
            ->assertSessionHas('success');

        // Verifikasi CMS Tentang Kami tersimpan
        $about = AboutPageSettings::getForAdmin();
        $this->assertSame('CV Ragil Aluminium Mandiri', $about['hero_title']);
        $this->assertSame('Sejak 2008 Berkarya', $about['hero_subtitle']);
        $this->assertCount(2, $about['gallery_items']);
        $this->assertSame('Mesin Potong', $about['gallery_items'][0]['title']);
        $this->assertCount(2, $about['stats_items']);
        $this->assertSame('16+', $about['stats_items'][0]['value']);

        // Verifikasi sinkronisasi kontak toko (StoreContactSettings)
        $contact = StoreContactSettings::get();
        $this->assertSame('Jl. Raya Mandiraja No. 99, Banjarnegara', $contact['address']);
        $this->assertSame('081234567899', $contact['phone']);
        $this->assertSame('halo@ragilaluminium.com', $contact['email']);

        // Verifikasi sinkronisasi platform marketplace & sosmed (StorefrontPlatformSettings)
        $linkMap = StorefrontPlatformSettings::linkMap();
        $this->assertSame('https://instagram.com/ragilaluminium.official', $linkMap['instagram']);
        $this->assertSame('https://shopee.co.id/ragilaluminium', $linkMap['shopee']);
    }

    public function test_storefront_about_page_renders_with_custom_and_fallback_data(): void
    {
        // 1. Kondisi awal tanpa kustomisasi: harus memakai fallback baku lengkap
        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/About')
                ->where('page.title', 'Ragil Aluminium')
                ->where('page.subtitle', 'Sejak 2008')
                ->has('page.why_points', 4)
                ->has('page.production_processes', 3)
                ->has('page.work_steps', 3)
                ->has('page.trust_rows', 4)
                ->has('page.stats_items', 4));

        // 2. Kondisi kustomisasi terisi
        $admin = $this->admin();
        $this->actingAs($admin)->put(route('admin.tentang-kami.update'), [
            'hero_title' => 'Toko Ragil Mandiraja',
            'hero_headline' => 'Kualitas Aluminium Terbaik',
            'stats_items' => [
                ['value' => '99%', 'label' => 'Kepuasan Pelanggan', 'description' => 'Review positif'],
            ],
            'gallery_items' => [
                ['url' => 'https://cdn.example.com/foto1.jpg', 'title' => 'Workshop 1', 'caption' => 'Peralatan potong'],
            ],
        ]);

        $this->get(route('about'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/About')
                ->where('page.title', 'Toko Ragil Mandiraja')
                ->where('page.headline', 'Kualitas Aluminium Terbaik')
                ->has('page.gallery_items', 1)
                ->has('page.stats_items', 1)
                ->where('page.stats_items.0.value', '99%'));
    }

    public function test_validation_rejects_invalid_contact_email(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->put(route('admin.tentang-kami.update'), [
                'contact' => [
                    'email' => 'bukan-email-valid',
                ],
            ])
            ->assertSessionHasErrors('contact.email');
    }
}
