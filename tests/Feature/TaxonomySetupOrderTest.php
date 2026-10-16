<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogLabels;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Alur resmi yang owner setujui: admin membuat Kategori, Model, lalu Sub Model
 * LEBIH DULU, baru mengimpor XLSX. Test ini memastikan setiap langkah langsung
 * terlihat di langkah berikutnya tanpa menunggu cache kedaluwarsa.
 *
 * Sebelum 16 Okt 2026 cache `catalog.sub_model_codes.*` hanya dibersihkan di
 * metode destroy controller, sehingga sub model yang baru dibuat atau
 * dinonaktifkan TIDAK langsung terlihat (menunggu TTL 1 jam). Kini pembersihan
 * ditaruh di SubModel::booted() supaya berlaku untuk semua jalur.
 */
class TaxonomySetupOrderTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function kosongkan(): void
    {
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();
    }

    private function buatModel(string $code = 'PARTISI_GESER'): CmsModelProduct
    {
        $model = CmsModelProduct::create([
            'name' => 'Partisi Geser',
            'product_category' => 'PINTU',
            'product_model' => $code,
            'status' => 'active',
        ]);
        \Illuminate\Support\Facades\Cache::flush();

        return $model;
    }

    public function test_sub_model_baru_langsung_muncul_di_daftar_sub_model(): void
    {
        $this->kosongkan();
        $admin = $this->admin();
        $this->buatModel();

        // Hangatkan cache lebih dulu (meniru admin sudah membuka halaman lain).
        $this->assertNotContains('KISI_KISI', CatalogLabels::designCodes(), 'prasyarat: belum ada');

        $this->actingAs($admin)->post(route('admin.sub-models.store'), [
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
        ])->assertRedirect();

        $this->assertDatabaseHas('sub_models', [
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
        ]);

        $this->assertContains(
            'KISI_KISI',
            CatalogLabels::designCodes(),
            'sub model baru harus langsung muncul tanpa menunggu cache'
        );
    }

    public function test_sub_model_baru_langsung_muncul_di_daftar_per_model(): void
    {
        $this->kosongkan();
        $admin = $this->admin();
        $this->buatModel();

        CatalogLabels::designCodes('PARTISI_GESER');

        $this->actingAs($admin)->post(route('admin.sub-models.store'), [
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
        ]);

        $this->assertContains(
            'KISI_KISI',
            CatalogLabels::designCodes('PARTISI_GESER'),
            'cache per model juga harus dibersihkan'
        );
    }

    public function test_nonaktifkan_sub_model_langsung_hilang(): void
    {
        $this->kosongkan();
        $admin = $this->admin();
        $this->buatModel();

        $sub = SubModel::create([
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
            'is_active' => true,
        ]);
        \Illuminate\Support\Facades\Cache::flush();

        $this->assertContains('KISI_KISI', CatalogLabels::designCodes());

        $this->actingAs($admin)->post(route('admin.sub-models.toggle', $sub));

        $this->assertNotContains(
            'KISI_KISI',
            CatalogLabels::designCodes(),
            'sub model yang dinonaktifkan harus langsung hilang tanpa menunggu cache'
        );
    }

    public function test_hapus_sub_model_langsung_hilang(): void
    {
        $this->kosongkan();
        $admin = $this->admin();
        $this->buatModel();

        $sub = SubModel::create([
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
            'is_active' => true,
        ]);
        \Illuminate\Support\Facades\Cache::flush();
        $this->assertContains('KISI_KISI', CatalogLabels::designCodes());

        $this->actingAs($admin)->delete(route('admin.sub-models.destroy', $sub));

        $this->assertNotContains('KISI_KISI', CatalogLabels::designCodes());
        $this->assertDatabaseMissing('sub_models', ['id' => $sub->id]);
    }

    public function test_urutan_lengkap_kategori_model_sub_model_siap_impor(): void
    {
        $this->kosongkan();
        $admin = $this->admin();

        // 1. Kategori baru.
        $this->actingAs($admin)->post(route('admin.categories.store'), [
            'name' => 'Partisi Ruangan',
            'code' => 'PARTISI',
            'slug' => 'partisi',
            'is_active' => true,
        ])->assertRedirect();
        \Illuminate\Support\Facades\Cache::flush();
        $this->assertContains('PARTISI', CatalogLabels::categoryCodes());

        // 2. Model baru di bawah kategori itu.
        $this->actingAs($admin)->post(route('admin.model-products.store'), [
            'name' => 'Partisi Geser Lipat',
            'product_model' => 'PARTISI_GESER',
            'product_category' => 'PARTISI',
            'status' => 'active',
        ])->assertRedirect();
        \Illuminate\Support\Facades\Cache::flush();
        $this->assertContains('PARTISI_GESER', CatalogLabels::modelCodes());

        // 3. Sub model baru di bawah model itu.
        $this->actingAs($admin)->post(route('admin.sub-models.store'), [
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
        ])->assertRedirect();

        // 4. Ketiganya langsung terlihat, siap dipakai di XLSX.
        $this->assertContains('PARTISI', CatalogLabels::categoryCodes());
        $this->assertContains('PARTISI_GESER', CatalogLabels::modelCodes());
        $this->assertContains('KISI_KISI', CatalogLabels::designCodes('PARTISI_GESER'));
    }
}
