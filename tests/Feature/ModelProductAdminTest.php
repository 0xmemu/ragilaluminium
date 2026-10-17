<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ModelProductAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_wadah_model_terselaras_otomatis_dan_urutan_tersimpan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Product::create([
            'parent_sku' => 'WIN-MOD-1',
            'name' => 'Jendela Sliding 1',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        Product::create([
            'parent_sku' => 'WIN-MOD-2',
            'name' => 'Jendela Sliding 2',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'archived',
        ]);

        // Wadah dibuat sendiri saat produk disimpan; tombol "Muat ulang katalog"
        // beserta route-nya dihapus 2026-09-28 (keputusan owner: semuanya otomatis).
        $this->assertFalse(\Illuminate\Support\Facades\Route::has('admin.model-products.sync'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.model-products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ModelProducts/Index')
                ->has('rows', 1)
                ->where('rows.0.active_count', 1)
                ->where('rows.0.archived_count', 1)
                ->where('rows.0.sub_model_count', 2));

        // Kontrak owner 2026-09-10: wadah kosong (0 produk aktif) tidak tampil
        // di storefront. Model dengan produk tetap tampil.
        CmsModelProduct::create([
            'name' => 'Jendela Aluminium Kaca Mati',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'active',
            'sort_order' => 9,
        ]);

        $pairOf = fn (array $card) => strtoupper((string) $card['category']).'|'.strtoupper((string) $card['model']);

        $cards = app(\App\Services\ModelProductService::class)->storefrontCards();
        $this->assertContains('JENDELA|SLIDING', array_map($pairOf, $cards));
        $this->assertNotContains('JENDELA|KACA_MATI', array_map($pairOf, $cards));

        // Auto-arsip: sinkronisasi mematikan pasangan CMS yang tidak punya
        // produk aktif lagi (kontrak owner: wadah = produk yang bisa dibeli).
        // Pasangan yang masih punya produk aktif tidak disentuh.
        Product::create([
            'parent_sku' => 'WIN-OLD-1',
            'name' => 'Jendela Swing Lama',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'archived',
        ]);
        CmsModelProduct::create([
            'name' => 'Jendela Aluminium Swing',
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'status' => 'active',
            'sort_order' => 10,
        ]);

        // Auto-nonaktif kini hanya menyasar wadah YATIM, yaitu wadah yang
        // tidak punya produk sama sekali (revisi 17 Okt 2026). Wadah yang
        // produknya masih ada tetapi sedang diarsipkan dibiarkan mengikuti
        // pilihan admin, karena itulah keadaan normal katalog hasil impor.
        $result = app(\App\Services\ModelProductService::class)->syncFromCatalog($admin->id);
        $this->assertSame(0, $result['created']);
        // Tidak ada lagi wadah yang perlu dimatikan pada langkah ini: KACA_MATI
        // sudah dimatikan saat produk SWING disimpan, sedangkan SLIDING dan
        // SWING masih berisi produk.
        $this->assertSame(0, $result['archived']);
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'draft',
        ]);
        // Pasangan yang masih punya produk arsip tidak diarsipkan.
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'active',
        ]);

        // Setelah diarsip otomatis, baris harus diaktifkan admin (satu klik)
        // untuk tampil lagi, agar model yang disembunyikan admin sengaja
        // tidak bangkit sendiri. Setelah diaktifkan + wadah terisi, tampil.
        $cardsStillHidden = app(\App\Services\ModelProductService::class)->storefrontCards();
        $this->assertNotContains('JENDELA|KACA_MATI', array_map($pairOf, $cardsStillHidden));

        Product::create([
            'parent_sku' => 'WIN-MOD-3',
            'name' => 'Jendela Kaca Mati 1',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'KACA_MATI')
            ->update(['status' => 'active']);

        $cardsAfter = app(\App\Services\ModelProductService::class)->storefrontCards();
        $this->assertContains('JENDELA|KACA_MATI', array_map($pairOf, $cardsAfter));

        $item = CmsModelProduct::query()->first();
        $this->actingAs($admin)
            ->put(route('admin.model-products.reorder'), [
                'rows' => [
                    ['id' => $item->id, 'sort_order' => 5],
                ],
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertSame(5, (int) $item->fresh()->sort_order);
    }

    public function test_admin_can_create_and_home_uses_cms_model_order(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Product::create([
            'parent_sku' => 'WIN-JUNG-1',
            'name' => 'Jungkit',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JENDELA_JUNGKIT_UNGGULAN',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        // Wadah sudah terbuat otomatis dari produk di atas, jadi admin tidak
        // menambah baris baru melainkan mengisi konten wadah yang sudah ada.
        $wadah = CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'JENDELA_JUNGKIT_UNGGULAN')
            ->firstOrFail();

        $this->actingAs($admin)
            ->put(route('admin.model-products.update', $wadah), [
                'name' => 'Jendela Jungkit Unggulan',
                'product_category' => 'JENDELA',
                'image_url' => 'https://cdn.example.com/jungkit.jpg',
                'description' => 'Deskripsi jungkit dari admin untuk halaman detail model.',
                'status' => 'active',
                'sort_order' => 0,
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_model' => 'JENDELA_JUNGKIT_UNGGULAN',
            'description' => 'Deskripsi jungkit dari admin untuk halaman detail model.',
        ]);

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Home')
                ->where('modelCards.0.title', 'Jendela Jungkit Unggulan')
                ->where('modelCards.0.model', 'JENDELA_JUNGKIT_UNGGULAN')
                ->where('modelCards.0.desc', 'Deskripsi jungkit dari admin untuk halaman detail model.')
                ->where('modelCards.0.subtitle', null));

        $this->get(route('catalog.model', ['category' => 'jendela', 'model' => 'jendela-jungkit-unggulan']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/ModelDetail')
                ->where('model.desc', 'Deskripsi jungkit dari admin untuk halaman detail model.')
                ->where('model.subtitle', null));
    }

    /**
     * Penyelarasan otomatis menambah wadah baru dan mematikan wadah kosong,
     * TIDAK pernah mengaktifkan wadah nonaktif. Keputusan owner 2026-09-10
     * dipertahankan: model yang disembunyikan admin (atau hasil auto-arsip)
     * tidak bangkit sendiri walau produknya kembali aktif.
     */
    public function test_wadah_nonaktif_tidak_diaktifkan_otomatis(): void
    {
        Product::create([
            'parent_sku' => 'WIN-JUNG-AKTIF',
            'name' => 'Jungkit Aktif',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $wadah = CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'JUNGKIT')
            ->firstOrFail();

        // Admin menyembunyikan model walau produknya masih aktif.
        $wadah->update(['status' => 'draft']);

        // Perubahan produk berikutnya memicu penyelarasan otomatis. Karena
        // wadah JUNGKIT masih punya produk aktif, ia tidak diarsipkan; karena
        // statusnya draft, ia juga tidak diaktifkan kembali.
        Product::create([
            'parent_sku' => 'WIN-SWING-AKTIF',
            'name' => 'Swing Aktif',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->assertSame('draft', $wadah->fresh()->status);

        // Menambah produk baru pada model yang wadahnya draft pun tidak
        // mengaktifkannya kembali, dan tidak menduplikasi wadah.
        Product::create([
            'parent_sku' => 'WIN-JUNG-AKTIF-2',
            'name' => 'Jungkit Aktif 2',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $this->assertSame('draft', $wadah->fresh()->status);
        $this->assertSame(1, CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'JUNGKIT')
            ->count());
    }

    /**
     * Penyelarasan hanya dipicu perubahan yang menentukan wadah (kategori,
     * kode model, status). Perubahan lain tidak perlu penyelarasan sama sekali.
     */
    public function test_perubahan_yang_tidak_menentukan_wadah_tidak_memicu_penyelarasan(): void
    {
        $produk = Product::create([
            'parent_sku' => 'WIN-NAMA-1',
            'name' => 'Jendela Sliding',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $spy = $this->spy(\App\Services\ModelProductService::class);

        $produk->update(['name' => 'Jendela Sliding Revisi']);

        $spy->shouldNotHaveReceived('syncFromCatalog');
    }

    /**
     * Penyelarasan wadah adalah efek samping, bukan syarat simpan produk:
     * kegagalannya dilaporkan tetapi tidak boleh menggagalkan pekerjaan admin.
     */
    public function test_kegagalan_penyelarasan_tidak_menggagalkan_simpan_produk(): void
    {
        $this->mock(\App\Services\ModelProductService::class, function ($mock): void {
            $mock->shouldReceive('syncFromCatalog')->andThrow(new \RuntimeException('penyelarasan gagal'));
        });

        Product::create([
            'parent_sku' => 'WIN-GAGAL-1',
            'name' => 'Jendela Gagal Selaras',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('products', ['parent_sku' => 'WIN-GAGAL-1']);
    }

    /**
     * Pasangan yang belum punya wadah (mis. model yang belum punya produk)
     * tetap bisa ditambah manual lewat form.
     */
    public function test_tambah_model_untuk_pasangan_tanpa_produk_tetap_bisa(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Boven Jungkit Empat Daun',
                'product_category' => 'BOVEN',
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.model-products.index'));

        // Kode otomatis membuang kata kategori karena kode selalu berpasangan
        // dengan kategori; mengulangnya membuat kode panjang tanpa manfaat.
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'BOVEN',
            'product_model' => 'JUNGKIT_EMPAT_DAUN',
        ]);
        $this->assertSame(1, CmsModelProduct::query()->count());
    }

    /**
     * Kode yang diisi admin dipakai apa adanya, termasuk bila admin sengaja
     * memilih satu kata singkat seperti JUNGKIT.
     */
    public function test_kode_model_yang_diisi_admin_dipakai_apa_adanya(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Jendela Jungkit Satu Daun',
                'product_model' => 'JUNGKIT',
                'product_category' => 'JENDELA',
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
        ]);
    }

    /**
     * Nama yang seluruhnya terdiri dari kata kategori tidak boleh menghasilkan
     * kode kosong; kata nama dipakai ulang sebagai jaring pengaman.
     */
    public function test_kode_model_tidak_pernah_kosong_bila_nama_hanya_kata_kategori(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Jendela',
                'product_category' => 'JENDELA',
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'JENDELA',
        ]);
    }

    /**
     * Pasangan yang sudah punya wadah (otomatis dari produk) tidak boleh
     * ditambah lagi: baris kembar membuat kartu model tampil dua kali di toko.
     * Admin diarahkan melengkapi baris yang sudah ada.
     */
    /**
     * Kasus nyata 17 Okt 2026: setelah impor, semua produk berstatus arsip.
     * Wadah tidak boleh dimatikan otomatis, dan tombol Aktifkan harus bekerja
     * untuk wadah yang sudah pernah dinonaktifkan.
     */
    public function test_wadah_berisi_produk_arsip_tetap_aktif_dan_bisa_dinyalakan_lagi(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Product::create([
            'parent_sku' => 'WIN-IMP-1',
            'name' => 'Jendela Jungkit Hasil Impor',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            // Importer selalu menulis produk baru sebagai arsip.
            'status' => 'archived',
        ]);

        $wadah = CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'JUNGKIT')
            ->firstOrFail();

        $this->assertSame(
            'active',
            $wadah->status,
            'wadah yang masih berisi produk tidak boleh dimatikan otomatis'
        );

        // Admin menyembunyikan, lalu menyalakannya kembali.
        $this->actingAs($admin)
            ->post(route('admin.model-products.deactivate', $wadah))
            ->assertRedirect();
        $this->assertSame('draft', $wadah->fresh()->status);

        $this->actingAs($admin)
            ->post(route('admin.model-products.activate', $wadah))
            ->assertRedirect();
        $this->assertSame(
            'active',
            $wadah->fresh()->status,
            'tombol Aktifkan harus benar-benar mengaktifkan wadah'
        );

        // Perubahan produk berikutnya tidak mematikannya lagi.
        Product::create([
            'parent_sku' => 'WIN-IMP-2',
            'name' => 'Jendela Jungkit Hasil Impor 2',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'archived',
        ]);

        $this->assertSame('active', $wadah->fresh()->status);
    }

    public function test_wadah_tanpa_produk_sama_sekali_tetap_dinonaktifkan_otomatis(): void
    {
        // Wadah buatan admin untuk pasangan yang belum punya produk.
        CmsModelProduct::create([
            'name' => 'Jendela Kaca Mati',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'active',
            'sort_order' => 1,
        ]);

        // Perubahan produk pada model lain memicu penyelarasan.
        Product::create([
            'parent_sku' => 'WIN-SLD-1',
            'name' => 'Jendela Sliding',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'draft',
        ]);
    }

    public function test_tambah_model_pasangan_sudah_punya_wadah_diarahkan_ke_edit(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Product::create([
            'parent_sku' => 'WIN-SWING-KEMBAR',
            'name' => 'Jendela Swing',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $wadah = CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'SWING')
            ->firstOrFail();

        // Nama "Swing" menghasilkan kode model SWING, yaitu pasangan yang sama
        // dengan wadah otomatis di atas.
        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Swing',
                'product_category' => 'JENDELA',
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.model-products.edit', $wadah));

        $this->assertSame(1, CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'SWING')
            ->count());
    }
}
