<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresi 17 Okt 2026 (laporan owner): setelah sub model dihapus, halaman
 * daftar langsung memakai filter model produk padahal admin tidak memakainya.
 *
 * Penyebabnya redirect destroy selalu menyertakan product_model. Sekarang
 * halaman kembali ke keadaan SEBELUM penghapusan: tanpa filter bila memang
 * tidak memfilter, dan tetap memfilter bila admin sedang memakainya.
 */
class SubModelDeleteKeepsFilterStateTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /**
     * Kode sengaja unik supaya tidak bentrok dengan sub model bawaan migrasi
     * (JUNGKIT/ORNAMEN dan kawan-kawan sudah tersemai saat tabel dibuat).
     */
    private function subModel(string $model = 'JUNGKIT', string $code = 'UJI_HAPUS'): SubModel
    {
        return SubModel::create([
            'product_model' => $model,
            'code' => $code,
            'name' => 'Uji Hapus',
            'sort_order' => 10,
            'is_active' => true,
        ]);
    }

    public function test_hapus_tanpa_filter_kembali_tanpa_filter(): void
    {
        $sub = $this->subModel();
        $daftar = route('admin.sub-models.index');

        $res = $this->actingAs($this->admin())
            ->from($daftar)
            ->delete(route('admin.sub-models.destroy', $sub));

        $res->assertRedirect($daftar);

        $this->assertStringNotContainsString(
            'product_model',
            (string) $res->headers->get('Location'),
            'menghapus sub model tidak boleh mengaktifkan filter model'
        );
        $this->assertDatabaseMissing('sub_models', ['id' => $sub->id]);
    }

    public function test_hapus_saat_memfilter_tetap_memfilter(): void
    {
        $sub = $this->subModel('JUNGKIT', 'UJI_HAPUS');
        $urlFilter = route('admin.sub-models.index', ['product_model' => 'JUNGKIT']);

        $res = $this->actingAs($this->admin())
            ->from($urlFilter)
            ->delete(route('admin.sub-models.destroy', $sub));

        $res->assertRedirect($urlFilter);

        $this->assertStringContainsString(
            'product_model=JUNGKIT',
            (string) $res->headers->get('Location'),
            'filter yang memang sedang dipakai admin harus dipertahankan'
        );
    }

    public function test_hapus_dari_luar_halaman_daftar_jatuh_ke_daftar_tanpa_filter(): void
    {
        $sub = $this->subModel();

        $res = $this->actingAs($this->admin())
            ->from(route('admin.model-products.index'))
            ->delete(route('admin.sub-models.destroy', $sub));

        $res->assertRedirect(route('admin.sub-models.index'));
        $this->assertStringNotContainsString(
            'product_model',
            (string) $res->headers->get('Location')
        );
    }

    public function test_sub_model_terpakai_produk_tetap_ditolak(): void
    {
        $sub = $this->subModel();

        \App\Models\Product::create([
            'parent_sku' => 'RA-SUB-1',
            'name' => 'Produk Pakai Sub Model',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'UJI_HAPUS',
            'status' => 'active',
        ]);

        $res = $this->actingAs($this->admin())
            ->from(route('admin.sub-models.index'))
            ->delete(route('admin.sub-models.destroy', $sub));

        $res->assertRedirect(route('admin.sub-models.index'));
        $this->assertDatabaseHas('sub_models', ['id' => $sub->id]);
    }
}
