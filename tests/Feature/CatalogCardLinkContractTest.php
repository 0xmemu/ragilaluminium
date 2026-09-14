<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Support\InertiaCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Kontrak tautan kartu katalog: kartu menunjuk ke PRODUK, bukan ke varian.
 *
 * Satu produk = satu ukuran (ukuran terkunci lewat parent_sku di URL), dan
 * seluruh varian dalam satu produk berdimensi identik. Jadi parameter
 * `variant` pada tautan kartu tidak menambah informasi ukuran - ia hanya
 * mengunci warna/kaca tanpa pelanggan memilihnya, dan itu berisiko salah beli.
 * Tautan varian tetap sah, tetapi hanya ditulis setelah pelanggan memilih
 * (lihat resources/js/lib/variants.ts).
 */
class CatalogCardLinkContractTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function makeProductWithVariants(): array
    {
        $product = Product::create([
            'parent_sku' => 'RACARDLINK01',
            'name' => 'Uji Kartu Katalog',
            'short_name' => 'Uji',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $small = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RACARDLINK01-A',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'variation_2_name' => 'Kaca',
            'variation_2_option' => 'Kaca Bening',
            'price' => 800000,
            'stock' => 5,
            'height_cm' => 130,
            'width_cm' => 130,
            'status' => 'active',
        ]);

        $other = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RACARDLINK01-B',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Hitam',
            'variation_2_name' => 'Kaca',
            'variation_2_option' => 'Kaca Riben',
            'price' => 850000,
            'stock' => 2,
            'height_cm' => 130,
            'width_cm' => 130,
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'stored_url' => 'https://cdn.example/card-link.jpg',
            'status' => 'downloaded',
        ]);

        return [$product->fresh(['mainImage', 'media', 'activeVariants', 'attributes']), $small, $other];
    }

    public function test_kartu_produk_tidak_menempelkan_variant_pada_tautan(): void
    {
        [$product] = $this->makeProductWithVariants();

        $card = InertiaCatalog::productCard($product);

        $this->assertSame('/product/RACARDLINK01', $card['href']);
        $this->assertStringNotContainsString('variant', $card['href']);
    }

    public function test_kartu_ukuran_tidak_menempelkan_variant_pada_tautan(): void
    {
        [$product, $variant] = $this->makeProductWithVariants();

        $card = InertiaCatalog::sizeCard($product, $variant);

        $this->assertSame('/product/RACARDLINK01', $card['href']);
        $this->assertStringNotContainsString('variant', $card['href']);
    }

    public function test_kartu_tetap_membawa_identitas_varian_untuk_keperluan_lain(): void
    {
        [$product, $variant] = $this->makeProductWithVariants();

        $card = InertiaCatalog::productCard($product);

        $this->assertSame('RACARDLINK01-A', $card['variant_sku']);
        $this->assertSame('RACARDLINK01-'.$variant->id, $card['card_key']);
    }

    public function test_tautan_kartu_tetap_menampilkan_halaman_produk(): void
    {
        [$product] = $this->makeProductWithVariants();

        $card = InertiaCatalog::productCard($product);

        $this->get($card['href'])->assertOk();
    }

    public function test_halaman_produk_tanpa_variant_tetap_dapat_dibuka(): void
    {
        $this->makeProductWithVariants();

        $this->get('/product/RACARDLINK01')->assertOk();
    }
}
