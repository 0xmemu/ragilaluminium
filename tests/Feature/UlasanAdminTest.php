<?php

namespace Tests\Feature;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UlasanAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_ulasan_website_tab_lists_and_creates_testimonial(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);
        $product = Product::create([
            'parent_sku' => 'WIN-ULASAN-1',
            'name' => 'Jendela Ulasan',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Budi Santoso',
            'message' => 'Kualitas bagus',
            'rating' => 5,
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('tab', 'website')
                ->has('rows', 1)
                ->where('rows.0.customer_name', 'Budi Santoso'));

        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Ani',
                'message' => 'Recommended',
                'rating' => 4,
                'source' => 'whatsapp',
                'location' => 'Kudus',
                'product_id' => '',
                'image_url' => '',
                'sort_order' => 1,
                'published' => true,
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'website']));

        $this->assertDatabaseHas('cms_testimonials', [
            'customer_name' => 'Ani',
            'source' => 'whatsapp',
            'published' => 1,
            'product_id' => null,
        ]);
    }

    public function test_admin_ulasan_foto_tab_lists_and_creates_gallery_item(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::create([
            'slug' => 'hasil-pemasangan',
            'title' => 'Hasil Pemasangan',
            'content' => [],
            'published' => true,
        ]);

        CmsGalleryItem::create([
            'cms_page_id' => $page->id,
            'image_url' => 'https://cdn.example.com/a.jpg',
            'label' => 'Pemasangan Kudus',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'foto']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('tab', 'foto')
                ->has('rows', 1)
                ->where('rows.0.label', 'Pemasangan Kudus'));

        $this->actingAs($admin)
            ->get(route('admin.gallery-items.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Testimonials/GalleryForm'));

        $this->actingAs($admin)
            ->post(route('admin.gallery-items.store'), [
                'label' => 'Pemasangan Semarang',
                'image_url' => 'https://cdn.example.com/b.jpg',
                'sort_order' => 2,
                'published' => true,
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'foto']));

        $this->assertDatabaseHas('cms_gallery_items', [
            'label' => 'Pemasangan Semarang',
            'image_url' => 'https://cdn.example.com/b.jpg',
            'published' => 1,
        ]);
    }

    public function test_admin_can_publish_and_unpublish_ulasan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);
        $testimonial = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Draft User',
            'message' => 'Belum tayang',
            'source' => 'website',
            'published' => false,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.publish', $testimonial))
            ->assertRedirect();

        $this->assertTrue($testimonial->fresh()->published);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.unpublish', $testimonial))
            ->assertRedirect();

        $this->assertFalse($testimonial->fresh()->published);
    }

    public function test_pengaturan_apa_kata_pelanggan_lists_and_updates_meta(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [
                'heading' => 'Apa kata pelanggan kami.',
                'subtitle' => 'Subjudul lama',
            ],
            'published' => true,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Siti',
            'message' => 'Bagus sekali',
            'source' => 'website',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.apa-kata-pelanggan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('title', 'Apa Kata Pelanggan Kami')
                ->where('tab', 'website')
                ->where('indexRoute', 'admin.apa-kata-pelanggan.index')
                ->has('pageMeta')
                ->where('pageMeta.heading', 'Apa kata pelanggan kami.')
                ->has('rows', 1)
                ->where('rows.0.customer_name', 'Siti'));

        $this->actingAs($admin)
            ->put(route('admin.apa-kata-pelanggan.meta.update'), [
                'title' => 'Ulasan Toko',
                'heading' => 'Cerita pelanggan kami.',
                'subtitle' => 'Dari Shopee dan WhatsApp.',
                'published' => true,
            ])
            ->assertRedirect(route('admin.apa-kata-pelanggan.index'));

        $this->assertDatabaseHas('cms_pages', [
            'slug' => 'testimoni',
            'title' => 'Ulasan Toko',
            'published' => 1,
        ]);

        $fresh = CmsPage::query()->where('slug', 'testimoni')->first();
        $this->assertSame('Cerita pelanggan kami.', $fresh->content['heading'] ?? null);
        $this->assertSame('Dari Shopee dan WhatsApp.', $fresh->content['subtitle'] ?? null);
    }

    public function test_pengaturan_hasil_pemasangan_lists_and_updates_meta(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::create([
            'slug' => 'hasil-pemasangan',
            'title' => 'Hasil Pemasangan',
            'content' => [
                'heading' => 'Hasil pemasangan',
                'subtitle' => 'Subjudul lama',
            ],
            'published' => true,
        ]);

        CmsGalleryItem::create([
            'cms_page_id' => $page->id,
            'image_url' => 'https://cdn.example.com/install.jpg',
            'label' => 'Pemasangan Kudus',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('title', 'Hasil Pemasangan Kami')
                ->where('tab', 'foto')
                ->where('indexRoute', 'admin.hasil-pemasangan.index')
                ->has('pageMeta')
                ->where('pageMeta.heading', 'Hasil pemasangan')
                ->has('rows', 1)
                ->where('rows.0.label', 'Pemasangan Kudus'));

        $this->actingAs($admin)
            ->put(route('admin.hasil-pemasangan.meta.update'), [
                'title' => 'Galeri Toko',
                'heading' => 'Dokumentasi pemasangan kami.',
                'subtitle' => 'Foto dari pelanggan Kudus dan Semarang.',
                'published' => true,
            ])
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

        $this->assertDatabaseHas('cms_pages', [
            'slug' => 'hasil-pemasangan',
            'title' => 'Galeri Toko',
            'published' => 1,
        ]);

        $fresh = CmsPage::query()->where('slug', 'hasil-pemasangan')->first();
        $this->assertSame('Dokumentasi pemasangan kami.', $fresh->content['heading'] ?? null);
        $this->assertSame('Foto dari pelanggan Kudus dan Semarang.', $fresh->content['subtitle'] ?? null);
    }
}
