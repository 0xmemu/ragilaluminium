<?php

namespace Tests\Feature;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\MediaAsset;
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
            'product_category' => 'JENDELA',
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
            'image_url' => 'https://cdn.example.com/budi.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
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
                'image_url' => 'https://cdn.example.com/ani-wa.jpg',
                'sort_order' => 1,
                'published' => true,
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'eksternal']));

        $this->assertDatabaseHas('cms_testimonials', [
            'customer_name' => 'Ani',
            'source' => 'whatsapp',
            'published' => 1,
            'product_id' => null,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Screenshot Only',
                'message' => '',
                'rating' => '',
                'source' => 'shopee',
                'location' => '',
                'product_id' => '',
                'image_url' => 'https://cdn.example.com/ss-shopee.jpg',
                'sort_order' => 2,
                'published' => true,
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'eksternal']));

        $this->assertDatabaseHas('cms_testimonials', [
            'customer_name' => 'Screenshot Only',
            'source' => 'shopee',
            'image_url' => 'https://cdn.example.com/ss-shopee.jpg',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'No Screenshot',
                'message' => 'tanpa gambar',
                'source' => 'whatsapp',
                'image_url' => '',
                'published' => true,
            ])
            ->assertSessionHasErrors(['image', 'image_url']);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Empty',
                'message' => '',
                'source' => 'website',
                'image_url' => '',
                'published' => true,
            ])
            ->assertSessionHasErrors(['message', 'image_url']);
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

        // tab=foto dialihkan ke menu Hasil Pemasangan Kami (satu pintu untuk galeri).
        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'foto']))
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

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
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

        $this->assertDatabaseHas('cms_gallery_items', [
            'label' => 'Pemasangan Semarang',
            'image_url' => 'https://cdn.example.com/b.jpg',
            'published' => 1,
        ]);
    }

    public function test_admin_can_change_testimonial_source_from_table(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        $testimonial = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Pelanggan Screenshot',
            'source' => 'website',
            'image_url' => 'https://cdn.example.com/ss.jpg',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.source', $testimonial), ['source' => 'shopee'])
            ->assertRedirect();

        $this->assertDatabaseHas('cms_testimonials', [
            'id' => $testimonial->id,
            'source' => 'shopee',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.source', $testimonial), ['source' => 'bukan-sumber'])
            ->assertSessionHasErrors('source');
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

    /**
     * Keputusan owner 2026-09-29: toggle "Tampilkan di storefront" dihapus dari
     * form, ulasan langsung aktif saat dibuat. Menyembunyikan tetap bisa lewat
     * aksi di daftar.
     */
    public function test_ulasan_baru_langsung_aktif_tanpa_toggle(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Form baru tidak mengirim kunci published sama sekali.
        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Langsung Aktif',
                'message' => 'Tanpa toggle',
                'source' => 'website',
            ])
            ->assertSessionHasNoErrors();

        $ulasan = CmsTestimonial::query()->firstOrFail();
        $this->assertTrue((bool) $ulasan->published, 'ulasan baru langsung aktif');
    }

    /**
     * Menyunting ulasan yang sudah disembunyikan TIDAK boleh menyalakannya lagi
     * hanya karena form tidak mengirim published.
     */
    public function test_menyunting_ulasan_tersembunyi_tidak_menyalakannya_lagi(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $halaman = CmsPage::create(['slug' => 'testimoni-sembunyi', 'title' => 'Testimoni', 'content' => [], 'published' => true]);
        $ulasan = CmsTestimonial::create([
            'cms_page_id' => $halaman->id,
            'customer_name' => 'Disembunyikan',
            'message' => 'Teks lama',
            'source' => 'website',
            'published' => false,
        ]);

        $this->actingAs($admin)
            ->put(route('admin.testimonials.update', $ulasan), [
                'customer_name' => 'Disembunyikan',
                'message' => 'Teks baru',
                'source' => 'website',
            ])
            ->assertSessionHasNoErrors();

        $this->assertFalse((bool) $ulasan->fresh()->published, 'status sembunyi dipertahankan');
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
            'message' => null,
            'image_url' => 'https://cdn.example.com/ss-shopee.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web Only',
            'message' => 'Beli di website',
            'source' => 'website',
            'published' => true,
            'sort_order' => 1,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.apa-kata-pelanggan.index'))
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'eksternal']));

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'eksternal']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('title', 'Ulasan Pelanggan')
                ->where('canReorder', true)
                ->has('reorderUrl')
                ->has('rows', 1)
                ->where('rows.0.customer_name', 'Siti')
                ->where('rows.0.source', 'shopee'));

        $this->actingAs($admin)
            ->put(route('admin.apa-kata-pelanggan.meta.update'), [
                'title' => 'Ulasan Toko',
                'heading' => 'Cerita pelanggan kami.',
                'subtitle' => 'Dari Shopee dan WhatsApp.',
                'published' => true,
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'eksternal']));

        $first = CmsTestimonial::query()->where('customer_name', 'Siti')->firstOrFail();
        $second = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Budi WA',
            'message' => null,
            'image_url' => 'https://cdn.example.com/ss-wa.jpg',
            'source' => 'whatsapp',
            'published' => true,
            'sort_order' => 5,
        ]);

        $this->actingAs($admin)
            ->put(route('admin.apa-kata-pelanggan.reorder'), [
                'rows' => [
                    ['id' => $second->id, 'sort_order' => 1],
                    ['id' => $first->id, 'sort_order' => 2],
                ],
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'eksternal']));

        // Nomor urut 1-based (kontrak nomor urut admin).
        $this->assertSame(1, $second->fresh()->sort_order);
        $this->assertSame(2, $first->fresh()->sort_order);

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

        // Penggabungan e2e: menu Hasil Pemasangan dipulihkan sebagai halaman galeri penuh.
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/InstallationGallery/Index'));

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'foto']))
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

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
    public function test_customer_review_text_is_immutable_but_admin_can_moderate_and_add_media(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::create(['slug' => 'testimoni', 'title' => 'Testimoni', 'content' => [], 'published' => true]);
        $review = CmsTestimonial::create([
            'cms_page_id' => $page->id, 'customer_name' => 'Pelanggan Asli', 'message' => 'Teks asli pelanggan',
            'rating' => 5, 'source' => 'website', 'published' => true, 'moderation_status' => 'approved',
        ]);

        $this->actingAs($admin)->put(route('admin.testimonials.update', $review), [
            '_method' => 'put', 'customer_name' => 'Nama Diubah', 'message' => 'Teks dipalsukan', 'rating' => 1,
            'source' => 'website', 'image_url' => '', 'image_urls' => [], 'published' => true,
        ])->assertRedirect();
        $this->assertSame('Teks asli pelanggan', $review->fresh()->message);
        $this->assertSame('Pelanggan Asli', $review->fresh()->customer_name);

        $this->actingAs($admin)->post(route('admin.testimonials.media', $review), [
            'media_url' => 'https://cdn.example.com/wa-screen.jpg', 'media_type' => 'image', 'media_source' => 'whatsapp',
        ])->assertRedirect();
        $this->assertSame('https://cdn.example.com/wa-screen.jpg', $review->fresh()->mediaPayload()[0]['url']);

        $this->actingAs($admin)->post(route('admin.testimonials.moderate', $review), [
            'moderation_status' => 'rejected',
        ])->assertRedirect();
        $this->assertSame('rejected', $review->fresh()->moderation_status);
        $this->assertFalse($review->fresh()->published);
        $this->assertDatabaseHas('event_logs', ['event_type' => 'cms.testimonial_moderated', 'entity_id' => $review->id]);
    }


    public function test_admin_can_switch_between_three_tabs_in_ulasan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'website']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('tab', 'website')
                ->has('tabs', 2));

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'eksternal']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Index')
                ->where('tab', 'eksternal')
                ->has('tabs', 2));

        // Halaman Ulasan hanya punya dua tab; tab foto tidak lagi tampil di sini.
        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'foto']))
            ->assertRedirect(route('admin.hasil-pemasangan.index'));
    }

    // =====================================================================
    // Banyak foto per ulasan (permintaan owner 2026-09-29).
    //
    // Sebelumnya form admin hanya menerima SATU gambar dari Media Library,
    // sehingga ulasan berfoto banyak harus diisi dengan menempel URL satu per
    // satu, padahal server dan storefront sudah mendukung banyak foto.
    // =====================================================================

    private function asetMedia(string $kunci): MediaAsset
    {
        return MediaAsset::create([
            'kind' => 'image',
            'label' => 'Aset '.$kunci,
            'checksum' => hash('sha256', $kunci),
            'object_key' => 'media-assets/'.$kunci.'/card.webp',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);
    }

    public function test_ulasan_bisa_menyimpan_banyak_foto_dari_media_library_berurutan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $pertama = $this->asetMedia('foto-pertama');
        $kedua = $this->asetMedia('foto-kedua');

        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Rina',
                'message' => 'Fotonya banyak',
                'source' => 'website',
                'published' => true,
                // Skema kanonik: daftar id aset berurutan + URL tempelan.
                // Foto pertama jadi gambar utama.
                'media_asset_ids' => [$pertama->id, $kedua->id],
                'image_urls' => ['https://cdn.example.com/foto-luar.jpg'],
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'website', 'channel' => 'website']));

        $ulasan = CmsTestimonial::query()->firstOrFail();
        $urlPertama = (string) $pertama->urlFor('pdp');
        $urlKedua = (string) $kedua->urlFor('pdp');

        // Gambar utama = foto pertama; sisanya tersimpan sebagai foto tambahan
        // berurutan (kolom image_url/image_urls tetap dipakai supaya seluruh
        // konsumen lama tidak perlu berubah). Urutan simpan mengikuti skema
        // form admin lain: foto Library dulu berurutan, lalu URL tempelan.
        $this->assertSame($urlPertama, $ulasan->image_url);
        $this->assertSame([$urlKedua, 'https://cdn.example.com/foto-luar.jpg'], $ulasan->image_urls);
        $this->assertSame(
            [$urlPertama, $urlKedua, 'https://cdn.example.com/foto-luar.jpg'],
            $ulasan->imagesPayload(),
            'foto library berurutan lebih dulu, lalu URL tempelan',
        );
    }

    public function test_menghapus_semua_foto_saat_edit_benar_benar_mengosongkan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $halaman = CmsPage::create(['slug' => 'testimoni-sari', 'title' => 'Testimoni', 'content' => [], 'published' => true]);
        $ulasan = CmsTestimonial::create([
            'cms_page_id' => $halaman->id,
            'customer_name' => 'Sari',
            'message' => 'Dengan foto',
            'source' => 'website',
            'image_url' => 'https://cdn.example.com/awal.jpg',
            'image_urls' => ['https://cdn.example.com/kedua.jpg'],
            'published' => true,
        ]);

        // Form baru selalu mengirim kunci daftar foto; daftar kosong berarti
        // admin menghapus semua foto dan tidak boleh diisi ulang dari nilai lama.
        $this->actingAs($admin)
            ->put(route('admin.testimonials.update', $ulasan), [
                'customer_name' => 'Sari',
                'message' => 'Dengan foto',
                'source' => 'website',
                'published' => true,
                'media_asset_ids' => [],
                'image_urls' => [],
            ])
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'website', 'channel' => 'website']));

        $ulasan->refresh();
        $this->assertNull($ulasan->image_url);
        $this->assertNull($ulasan->image_urls);
        $this->assertSame([], $ulasan->imagesPayload());
    }

    public function test_jumlah_foto_ulasan_dibatasi_max_photos(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Masing-masing daftar masih di bawah batas, tetapi gabungannya
        // melebihi batas total foto per ulasan.
        $aset = [];
        for ($i = 1; $i <= 6; $i++) {
            $aset[] = $this->asetMedia('aset-'.$i)->id;
        }
        $urls = [];
        for ($i = 1; $i <= 6; $i++) {
            $urls[] = 'https://cdn.example.com/foto-'.$i.'.jpg';
        }

        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Terlalu Banyak',
                'source' => 'website',
                'published' => true,
                'media_asset_ids' => $aset,
                'image_urls' => $urls,
            ])
            ->assertSessionHasErrors('media_asset_ids');

        $this->assertSame(0, CmsTestimonial::query()->count());
    }

    public function test_form_edit_menampilkan_semua_foto_tersimpan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $halaman = CmsPage::create(['slug' => 'testimoni-dewi', 'title' => 'Testimoni', 'content' => [], 'published' => true]);
        $ulasan = CmsTestimonial::create([
            'cms_page_id' => $halaman->id,
            'customer_name' => 'Dewi',
            'message' => 'Foto dari tiga sumber',
            'source' => 'website',
            'image_url' => 'https://cdn.example.com/utama.jpg',
            // Foto kiriman pelanggan tersimpan di media_items; dulu tidak
            // pernah tampil di form admin sehingga tidak bisa dikelola.
            'media_items' => [['type' => 'image', 'url' => 'https://cdn.example.com/pelanggan.jpg', 'source' => 'customer']],
            'published' => true,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.edit', $ulasan))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Testimonials/Form')
                ->where('maxPhotos', CmsTestimonial::MAX_PHOTOS)
                ->where('testimonial.photos', [
                    'https://cdn.example.com/utama.jpg',
                    'https://cdn.example.com/pelanggan.jpg',
                ]));
    }

    public function test_payload_lama_image_url_tetap_berjalan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Tanpa kunci photos, jalur lama (image_url + image_urls) tidak berubah.
        $this->actingAs($admin)
            ->post(route('admin.testimonials.store'), [
                'customer_name' => 'Lama',
                'message' => 'Pakai image_url',
                'source' => 'website',
                'image_url' => 'https://cdn.example.com/lama-utama.jpg',
                'image_urls' => ['https://cdn.example.com/lama-kedua.jpg'],
                'published' => true,
            ])
            ->assertSessionHasNoErrors();

        $ulasan = CmsTestimonial::query()->firstOrFail();
        $this->assertSame('https://cdn.example.com/lama-utama.jpg', $ulasan->image_url);
        $this->assertSame(['https://cdn.example.com/lama-kedua.jpg'], $ulasan->image_urls);
    }

}
