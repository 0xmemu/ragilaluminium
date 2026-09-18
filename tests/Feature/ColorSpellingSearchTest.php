<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\CatalogSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ejaan warna yang berbeda tipis harus saling terjangkau.
 *
 * Insiden 2026-09-18: satu berkas import memakai "Coklat" sementara katalog
 * memakai "Cokelat". Karena pencocokan warna mengutamakan nilai persis, satu
 * ejaan tidak menjangkau ejaan lain, sehingga hasil pencarian terbelah dua
 * untuk warna yang sama (158 produk vs 19 produk). Pemaksaan data ke satu
 * ejaan ditolak owner karena berisiko mengunci varian baru di masa depan.
 *
 * Solusinya mengelompokkan ejaan dari nilai yang benar-benar ada di DB, bukan
 * dari daftar tetap di kode, supaya warna dan ejaan baru ikut terbawa tanpa
 * mengubah kode.
 */
class ColorSpellingSearchTest extends TestCase
{
    use RefreshDatabase;

    private function produkDenganWarna(string $sku, string $warna): Product
    {
        $p = Product::create([
            "parent_sku" => $sku,
            "name" => "Jendela Uji " . $sku,
            "short_name" => "Jendela Uji",
            "category_id" => 1,
            "product_category" => "WINDOW",
            "product_model" => "SLIDING",
            "design_variant" => "POLOS",
            "status" => "active",
        ]);

        ProductVariant::create([
            "product_id" => $p->id,
            "variant_sku" => $sku . "-V1",
            "variation_1_name" => "Warna",
            "variation_1_option" => $warna,
            "price" => 800000,
            "stock" => 5,
            "status" => "active",
        ]);

        return $p;
    }

    /** @return list<int> */
    private function cari(string $term): array
    {
        return CatalogSearch::apply(Product::query(), $term)->pluck("id")->all();
    }

    public function test_satu_ejaan_menjangkau_ejaan_kembar_lainnya(): void
    {
        $lama = $this->produkDenganWarna("CS-LAMA", "Cokelat");
        $baru = $this->produkDenganWarna("CS-BARU", "Coklat");

        foreach (["cokelat", "coklat"] as $term) {
            $hasil = $this->cari($term);
            $this->assertContains($lama->id, $hasil, "kueri \"{$term}\" wajib menjangkau produk \"Cokelat\"");
            $this->assertContains($baru->id, $hasil, "kueri \"{$term}\" wajib menjangkau produk \"Coklat\"");
        }
    }

    public function test_salah_ketik_ringan_ikut_terjangkau(): void
    {
        $p = $this->produkDenganWarna("CS-TYPO", "Putih");

        $this->assertContains($p->id, $this->cari("putiih"), "ejaan salah ketik tetap menemukan produk");
    }

    public function test_warna_baru_di_luar_daftar_tetap_bisa_dicari(): void
    {
        // Warna yang tidak ada di daftar mana pun di kode.
        $p = $this->produkDenganWarna("CS-NEW", "Champagne");

        $this->assertContains(
            $p->id,
            $this->cari("champagne"),
            "warna baru wajib bisa dicari tanpa menambah daftar di kode"
        );
    }

    public function test_kata_pendek_tidak_digabung_asal_asal(): void
    {
        // "Es" dan "As" hanya beda 1 huruf, tetapi keduanya kata pendek sehingga
        // TIDAK boleh dianggap ejaan kembar.
        $es = $this->produkDenganWarna("CS-ES", "Es");
        $as = $this->produkDenganWarna("CS-AS", "As");

        $this->assertNotContains($as->id, $this->cari("es"), "\"es\" tidak boleh menjangkau \"As\"");
        $this->assertContains($es->id, $this->cari("es"), "\"es\" wajib menjangkau \"Es\"");
    }
}
