<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InstallationProjectAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    protected function model(): CmsModelProduct
    {
        return CmsModelProduct::create([
            'name' => 'Jendela Aluminium Kaca Mati',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'active',
            'sort_order' => 1,
        ]);
    }

    protected function product(CmsModelProduct $model): Product
    {
        $product = Product::create([
            'name' => 'Tinggi 70cm Jendela Kaca Mati',
            'parent_sku' => 'RA-TEST-001',
            'product_category' => $model->product_category,
            'product_model' => $model->product_model,
            'status' => 'active',
        ]);

        // Product::visible() menuntut minimal satu varian aktif.
        \App\Models\ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RA-TEST-001-V1',
            'price' => 500000,
            'stock' => 10,
            'status' => 'active',
        ]);

        return $product;
    }

    public function test_admin_can_view_installation_media_index(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/foto1.jpg',
            'position' => 100,
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 1)
                ->where('projects.data.0.kind', 'model')
                ->where('projects.data.0.media_count', 1)
                ->where('projects.data.0.sku_count', 1)
                ->has('tabs', 3)
                ->where('activeStatus', 'all')
            );
    }

    public function test_admin_can_filter_by_visibility_and_search(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/visible.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/hidden.jpg',
            'visibility' => 'hidden',
            'status' => 'downloaded',
        ]);

        // Kontrak dua status: tab hanya Semua / Aktif / Diarsipkan.
        // Grup aktif bila minimal satu medianya visible (media arsip di grup
        // yang sama tidak memindahkannya ke tab arsip).
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index', ['status' => 'active']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 1)
                ->where('projects.data.0.media_count', 2)
            );

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index', ['status' => 'archived']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 0)
            );

        // Pencarian berdasarkan nama model
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index', ['q' => 'Kaca Mati']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Index')
                ->has('projects.data', 1)
                ->where('projects.data.0.media_count', 2)
            );
    }

    /**
     * Kontrak owner 2026-09-29: urutan daftar grup Hasil Pemasangan menirukan
     * logika Model Produk dan Sub Model, yaitu grup yang masih tampil di toko
     * selalu di atas grup yang diarsipkan. Nomor urut tersimpan tidak diubah.
     */
    public function test_grup_diarsipkan_jatuh_ke_bawah_walau_nomor_urutnya_lebih_kecil(): void
    {
        $admin = $this->admin();

        // Grup AKTIF sengaja diberi nomor urut besar, grup ARSIP nomor kecil:
        // kalau urutan masih murni sort_order, grup arsip akan muncul lebih dulu.
        $modelAktif = $this->modelDenganUrutan('JENDELA', 'KACA_MATI', 'Jendela Aluminium Kaca Mati', 50);
        $modelArsip = $this->modelDenganUrutan('BOVEN', 'JUNGKIT', 'Boven Aluminium Jungkit', 1);

        $this->grupDenganMedia($modelAktif, 'AKTIF', 'visible');
        $this->grupDenganMedia($modelArsip, 'ARSIP', 'archived');

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('projects.data', 2)
                ->where('projects.data.0.visibility', 'visible')
                ->where('projects.data.0.model', 'KACA_MATI')
                ->where('projects.data.1.visibility', 'archived')
                ->where('projects.data.1.model', 'JUNGKIT'));

        // Tab status menyaring, tapi urutan kelompok tetap sama.
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index', ['status' => 'all']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('projects.data.0.visibility', 'visible'));

        $this->assertSame(50, $modelAktif->fresh()->installation_sort_order);
        $this->assertSame(1, $modelArsip->fresh()->installation_sort_order);
    }

    /**
     * Simpan urutan menulis nomor untuk semua grup yang dikirim (tab Semua),
     * termasuk grup arsip, tetapi penampilan tetap menaruh grup arsip di bawah
     * sehingga arsip otomatis memegang nomor paling besar.
     */
    public function test_simpan_urutan_menulis_nomor_semua_grup_dan_arsip_tetap_di_bawah(): void
    {
        $admin = $this->admin();

        $modelAktif = $this->modelDenganUrutan('JENDELA', 'KACA_MATI', 'Jendela Aluminium Kaca Mati', 50);
        $modelArsip = $this->modelDenganUrutan('BOVEN', 'JUNGKIT', 'Boven Aluminium Jungkit', 1);

        $this->grupDenganMedia($modelAktif, 'AKTIF', 'visible');
        $this->grupDenganMedia($modelArsip, 'ARSIP', 'archived');

        // Admin sengaja menaruh grup ARSIP di posisi pertama.
        $this->actingAs($admin)
            ->put(route('admin.hasil-pemasangan.reorder'), [
                'rows' => [
                    ['key' => 'model|BOVEN|JUNGKIT'],
                    ['key' => 'model|JENDELA|KACA_MATI'],
                ],
            ])
            ->assertRedirect();

        // Nomor urut tersimpan menuruti payload (arsip dapat nomor terkecil).
        $this->assertSame(1, $modelArsip->fresh()->installation_sort_order);
        $this->assertSame(2, $modelAktif->fresh()->installation_sort_order);

        // Penampilan tetap menaruh grup aktif di atas grup arsip.
        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('projects.data.0.visibility', 'visible')
                ->where('projects.data.1.visibility', 'archived'));

        // Log aksi massal wajib tersimpan dengan entitas ber-id (dulu id kosong
        // dan kolom entity_id NOT NULL, sehingga simpan urutan gagal 500).
        $log = \App\Models\EventLog::query()->where('event_type', 'installation_group.reordered')->latest('id')->first();
        $this->assertNotNull($log, 'log reorder harus tersimpan');
        $this->assertSame('cms_page', $log->entity_type);
        $this->assertGreaterThan(0, (int) $log->entity_id);
    }

    /**
     * Satu grup (model produk) lengkap dengan produk, varian aktif, dan satu
     * media hasil pemasangan. SKU dibuat unik per grup karena kolom parent_sku
     * dan variant_sku unik, sementara helper product() bawaan memakai SKU tetap.
     */
    /**
     * Model CMS dengan nomor urut hasil pemasangan. Kolom
     * installation_sort_order tidak ada di $fillable CmsModelProduct, jadi
     * diisi lewat query builder, sama seperti jalur reorder di controller.
     */
    protected function modelDenganUrutan(string $kategori, string $model, string $nama, int $urutan): CmsModelProduct
    {
        $row = CmsModelProduct::create([
            'name' => $nama,
            'product_category' => $kategori,
            'product_model' => $model,
            'status' => 'active',
            'sort_order' => 1,
        ]);

        CmsModelProduct::query()->whereKey($row->id)->update(['installation_sort_order' => $urutan]);

        return $row->fresh();
    }

    protected function grupDenganMedia(CmsModelProduct $model, string $suffix, string $visibility): Product
    {
        $product = Product::create([
            'name' => 'Produk '.$model->product_model.' '.$suffix,
            'parent_sku' => 'RA-GRUP-'.$suffix,
            'product_category' => $model->product_category,
            'product_model' => $model->product_model,
            'status' => 'active',
        ]);

        \App\Models\ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RA-GRUP-'.$suffix.'-V1',
            'price' => 500000,
            'stock' => 10,
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/'.$suffix.'.jpg',
            'position' => 100,
            'visibility' => $visibility,
            'status' => 'downloaded',
        ]);

        return $product;
    }

    public function test_admin_can_view_create_form(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $this->product($model);

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Form')
                ->has('modelProducts', 1)
                ->where('modelProducts.0.products.0.parent_sku', 'RA-TEST-001')
            );
    }

    public function test_store_creates_product_media_bound_to_sku(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        $this->actingAs($admin)
            ->post(route('admin.hasil-pemasangan.store'), [
                'model_product_id' => $model->id,
                'product_id' => $product->id,
                'description' => 'Pemasangan di rumah pelanggan Kudus',
                'main_image_url' => 'https://example.com/main.jpg',
            ])
            ->assertRedirect(route('admin.hasil-pemasangan.index'))
            ->assertSessionHas('success');

        $media = ProductMedia::where('is_installation', true)->get();
        $this->assertCount(1, $media);
        $this->assertSame($product->id, $media[0]->product_id);
        $this->assertNull($media[0]->model_product_id);
        $this->assertSame('visible', $media[0]->visibility);
    }

    public function test_store_creates_model_level_media_without_sku(): void
    {
        $admin = $this->admin();
        $model = $this->model();

        $this->actingAs($admin)
            ->post(route('admin.hasil-pemasangan.store'), [
                'model_product_id' => $model->id,
                'description' => 'Dokumentasi umum model',
                'main_image_url' => 'https://example.com/model.jpg',
            ])
            ->assertRedirect(route('admin.hasil-pemasangan.index'))
            ->assertSessionHas('success');

        $media = ProductMedia::where('is_installation', true)->first();
        $this->assertNotNull($media);
        $this->assertNull($media->product_id);
        $this->assertSame($model->id, $media->model_product_id);
    }

    public function test_store_rejects_sku_from_different_model(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $otherModel = CmsModelProduct::create([
            'name' => 'Boven Jungkit',
            'product_category' => 'BOVEN',
            'product_model' => 'JUNGKIT_1_DAUN',
            'status' => 'active',
            'sort_order' => 2,
        ]);
        $product = $this->product($model);

        $this->actingAs($admin)
            ->from(route('admin.hasil-pemasangan.create'))
            ->post(route('admin.hasil-pemasangan.store'), [
                'model_product_id' => $otherModel->id,
                'product_id' => $product->id,
                'main_image_url' => 'https://example.com/main.jpg',
            ])
            ->assertRedirect(route('admin.hasil-pemasangan.create'))
            ->assertSessionHasErrors('product_id');
    }

    public function test_store_creates_standalone_group_with_title(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post(route('admin.hasil-pemasangan.store'), [
                'title' => 'Kanopi Cafe Semarang',
                'main_image_url' => 'https://example.com/kanopi.jpg',
                'gallery_images' => [
                    ['url' => 'https://example.com/kanopi2.jpg', 'caption' => 'Tampak samping'],
                ],
            ])
            ->assertRedirect(route('admin.hasil-pemasangan.index'))
            ->assertSessionHas('success');

        $group = \App\Models\InstallationGroup::where('title', 'Kanopi Cafe Semarang')->first();
        $this->assertNotNull($group);

        $media = ProductMedia::where('installation_group_id', $group->id)->get();
        $this->assertCount(2, $media);
        $this->assertNull($media[0]->product_id);
        $this->assertNull($media[0]->model_product_id);
    }

    public function test_store_requires_title_for_standalone(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->from(route('admin.hasil-pemasangan.create'))
            ->post(route('admin.hasil-pemasangan.store'), [
                'main_image_url' => 'https://example.com/x.jpg',
            ])
            ->assertRedirect(route('admin.hasil-pemasangan.create'))
            ->assertSessionHasErrors('title');
    }

    public function test_admin_can_view_media_detail(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/foto.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.hasil-pemasangan.show', ['group' => 'JENDELA|KACA_MATI']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/InstallationGallery/Show')
                ->where('group.label', 'Jendela Aluminium Kaca Mati')
                ->has('group.media', 1)
                ->where('group.media.0.product_sku', 'RA-TEST-001')
            );
    }

    public function test_admin_can_toggle_media_visibility(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/foto.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->actingAs($admin)
            ->patch(route('admin.hasil-pemasangan.toggle-status', $media->id))
            ->assertRedirect();

        $this->assertSame('archived', $media->fresh()->visibility);

        $this->actingAs($admin)
            ->patch(route('admin.hasil-pemasangan.toggle-status', $media->id))
            ->assertRedirect();

        $this->assertSame('visible', $media->fresh()->visibility);
    }

    public function test_admin_can_archive_media(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/foto.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.hasil-pemasangan.archive', $media->id))
            ->assertRedirect();

        $this->assertSame('archived', $media->fresh()->visibility);
    }

    public function test_admin_can_delete_media(): void
    {
        $admin = $this->admin();
        $model = $this->model();
        $product = $this->product($model);

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/foto.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->actingAs($admin)
            ->delete(route('admin.hasil-pemasangan.destroy', $media->id))
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

        $this->assertDatabaseMissing('product_media', ['id' => $media->id]);
    }
}
