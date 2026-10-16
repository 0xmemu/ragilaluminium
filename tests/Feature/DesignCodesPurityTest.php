<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\SubModel;
use App\Support\CatalogLabels;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Penjaga: daftar sub model (desain) MURNI dari database, tanpa daftar
 * cadangan di kode.
 *
 * Sebelum 16 Okt 2026 `CatalogLabels::designCodes()` menggabungkan hasil query
 * dengan konstanta `DESIGN_ORDER` (6 desain lama: POLOS, ORNAMEN, KOMBINASI,
 * SERIES_A/B/C). Akibatnya saat tabel `sub_models` kosong, daftar sub model
 * tetap berisi 6 kode lama, padahal owner sudah memutuskan taksonomi harus
 * murni dari database (keputusan yang sama seperti penghapusan MODEL_ORDER).
 */
class DesignCodesPurityTest extends TestCase
{
    use RefreshDatabase;

    private function kosongkan(): void
    {
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();
    }

    public function test_daftar_sub_model_kosong_saat_tabel_kosong(): void
    {
        $this->kosongkan();

        $this->assertSame(
            [],
            CatalogLabels::designCodes(),
            'tabel sub_models kosong harus berarti daftar sub model kosong'
        );
        $this->assertSame([], CatalogLabels::designCodes('MODEL_APA_PUN'));
    }

    public function test_tidak_ada_kode_desain_lama_yang_bocor(): void
    {
        $this->kosongkan();

        $bocor = array_intersect(
            ['POLOS', 'ORNAMEN', 'KOMBINASI', 'SERIES_A', 'SERIES_B', 'SERIES_C'],
            CatalogLabels::designCodes()
        );

        $this->assertSame([], array_values($bocor), 'tidak boleh ada desain lama dari daftar cadangan');
    }

    public function test_daftar_sub_model_murni_dari_yang_terdaftar(): void
    {
        $this->kosongkan();

        SubModel::create([
            'product_model' => 'PARTISI_GESER',
            'code' => 'KISI_KISI',
            'name' => 'Desain Kisi-kisi',
            'is_active' => true,
        ]);
        SubModel::create([
            'product_model' => 'PARTISI_GESER',
            'code' => 'NONAKTIF',
            'name' => 'Tidak Aktif',
            'is_active' => false,
        ]);
        \Illuminate\Support\Facades\Cache::flush();

        $this->assertSame(
            ['KISI_KISI'],
            CatalogLabels::designCodes(),
            'hanya sub model AKTIF yang boleh muncul'
        );
    }

    public function test_konstanta_design_order_sudah_tidak_ada(): void
    {
        $this->assertFalse(
            defined('App\\Support\\CatalogLabels::DESIGN_ORDER'),
            'konstanta DESIGN_ORDER harus sudah dihapus dari kode'
        );
    }

    public function test_konstanta_model_order_sudah_tidak_ada(): void
    {
        $this->assertFalse(
            defined('App\\Support\\CatalogLabels::MODEL_ORDER'),
            'konstanta MODEL_ORDER harus sudah dihapus dari kode'
        );
    }

    public function test_konstanta_submodel_models_sudah_tidak_ada(): void
    {
        $this->assertFalse(
            defined('App\\Models\\SubModel::MODELS'),
            'konstanta SubModel::MODELS harus sudah dihapus dari kode'
        );
    }
}
