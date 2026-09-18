<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\InertiaCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak penamaan kartu katalog: nama produk yang diisi admin dipakai APA ADANYA.
 *
 * Kartu katalog pernah membangun nama sendiri dari kolom pengiriman
 * (height_cm/width_cm) sehingga pembeli melihat dua ukuran berbeda untuk satu
 * produk: kartu menulis "Tinggi 175cm x Panjang 105cm" sementara judul di
 * halaman produk menulis "Tinggi 40 cm x Panjang 90 cm (40x90)". Owner
 * menegaskan 2026-09-18: nama produk tidak boleh digenerate dari apa pun selain
 * nama yang diinput. Kolom dimensi tetap ada, tetapi hanya untuk pengiriman.
 *
 * Ukuran varian boleh dikirim sebagai metadata terpisah (size_label); yang
 * dilarang adalah menimpanya ke name/short_name.
 */
class CatalogCardNamingTest extends TestCase
{
    use RefreshDatabase;

    private function produk(string $name, string $sku, bool $populer = false): Product
    {
        return Product::create([
            "parent_sku" => $sku,
            "name" => $name,
            "category_id" => 1,
            "product_category" => "BOVEN",
            "product_model" => "JUNGKIT_2_DAUN",
            "design_variant" => "ORNAMEN",
            "status" => "active",
            // Dikurasi admin supaya muncul di carousel apa pun urutan yang dipakai.
            "homepage_popular" => $populer,
            "homepage_popular_sort" => $populer ? 1 : 0,
        ]);
    }

    private function varian(Product $p, string $sku, float $height, float $width): ProductVariant
    {
        return ProductVariant::create([
            "product_id" => $p->id,
            "variant_sku" => $sku,
            "price" => 3220000,
            "stock" => 10,
            "status" => "active",
            "height_cm" => $height,
            "width_cm" => $width,
        ]);
    }

    public function test_nama_kartu_sama_persis_dengan_nama_yang_diinput(): void
    {
        $nama = "Jendela Aluminium Boven 2 Daun Jungkit Casement Ornamen Tinggi 40 cm x Panjang 70 cm (40x70)";
        $p = $this->produk($nama, "RA-NAMING-1");
        // Dimensi pengiriman sengaja BEDA dari ukuran di judul, persis seperti
        // berkas import owner: judul 40x70, kolom dimensi 175x85.
        $this->varian($p, "RA-NAMING-1-V1", 175, 85);

        $card = InertiaCatalog::productCard(Product::with("activeVariants")->findOrFail($p->id));

        $this->assertSame($nama, $card["name"], "nama kartu wajib sama dengan nama yang diinput admin");
        $this->assertStringNotContainsString("175", (string) $card["name"], "dimensi pengiriman tidak boleh masuk ke nama");
    }

    public function test_kartu_per_ukuran_juga_tidak_mengganti_nama(): void
    {
        $nama = "Jendela Aluminium Boven 2 Daun Jungkit Casement Ornamen Tinggi 40 cm x Panjang 90 cm (40x90)";
        $p = $this->produk($nama, "RA-NAMING-2");
        $v = $this->varian($p, "RA-NAMING-2-V1", 185, 95);

        $card = InertiaCatalog::sizeCard(Product::with("activeVariants")->findOrFail($p->id), $v);

        $this->assertSame($nama, $card["name"], "kartu per ukuran juga tidak boleh mengganti nama");
        $this->assertSame("185x95", $card["size_dimension"], "ukuran tetap tersedia sebagai metadata");
    }

    public function test_ukuran_tetap_tersedia_sebagai_metadata_terpisah(): void
    {
        $p = $this->produk("Produk Metadata", "RA-NAMING-3");
        $this->varian($p, "RA-NAMING-3-V1", 175, 85);

        $card = InertiaCatalog::productCard(Product::with("activeVariants")->findOrFail($p->id));

        $this->assertSame("Tinggi 175cm \u{00D7} Panjang 85cm", $card["size_label"]);
        $this->assertSame("175x85", $card["size_dimension"]);
    }

    public function test_kartu_paling_banyak_dipesan_juga_memakai_nama_admin(): void
    {
        $nama = "Jendela Aluminium Boven 2 Daun Jungkit Casement Ornamen Tinggi 40 cm x Panjang 250 cm (40x250)";
        $p = $this->produk($nama, "RA-NAMING-4", true);
        $this->varian($p, "RA-NAMING-4-V1", 205, 115);

        $found = collect(InertiaCatalog::popularProductCards(10))->firstWhere("parent_sku", "RA-NAMING-4");

        $this->assertNotNull($found, "produk wajib muncul di kartu populer");
        $this->assertSame($nama, $found["name"], "kartu populer juga tidak boleh mengganti nama");
    }
}
