<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Rekomendasi "Anda mungkin juga suka" di halaman produk (kontrak owner 2026-09-16):
 *
 * Prioritas UTAMA adalah UKURAN, lalu model/submodel:
 *   1. model sama + ukuran sama
 *   2. model sama + tinggi sama, panjang selisih sedikit
 *   3. kategori sama (kedekatan ukuran)
 *   4. ukuran sama persis lintas model
 *   5. kurasi beranda, lalu seluruh katalog
 * Maksimal 10 kandidat (frontend 8 di mobile, 10 di desktop). "Lihat semua"
 * mengarah ke listing berfilter kategori + model + sub model. Bila tidak ada
 * kandidat, `relatedUrl` null supaya section disembunyikan.
 */
class ProductRelatedProductsContractTest extends TestCase
{
    use RefreshDatabase;

    /** Produk ber-SKU unik dengan varian aktif (syarat scope visible). */
    private function makeProduct(array $overrides = []): Product
    {
        $sku = $overrides['parent_sku'] ?? 'REL-'.strtoupper(uniqid());

        $product = Product::create(array_merge([
            'parent_sku' => $sku,
            'name' => 'Tinggi 100cm x Panjang 100cm '.$sku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SWING_2_DAUN',
            'design_variant' => 'ORNAMEN',
            'height_cm' => 180,
            'width_cm' => 130,
            'status' => 'active',
        ], $overrides));

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }

    /**
     * @return array{products: array, url: ?string}
     */
    private function recommendationsFor(Product $product): array
    {
        $props = [];

        // assertInertia tidak butuh header versi aset (kalau memakai respons
        // Inertia mentah, middleware membalas 409 saat versi tidak cocok).
        $this->get('/product/'.$product->parent_sku)
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) use (&$props) {
                $props = $page->toArray()['props'];
            });

        return [
            'products' => $props['relatedProducts'] ?? [],
            'url' => $props['relatedUrl'] ?? null,
        ];
    }

    /** @return list<string> */
    private function skusInOrder(array $recommendation): array
    {
        return array_map(fn (array $row) => (string) $row['parent_sku'], $recommendation['products']);
    }

    public function test_model_sama_dengan_ukuran_sama_menempati_urutan_pertama(): void
    {
        // Target 180x130 ORNAMEN. Saat ukuran diabaikan, desain setipe (ORNAMEN)
        // selalu menang; dengan prioritas ukuran, POLOS berukuran identik harus
        // mendahuluinya.
        $target = $this->makeProduct(['parent_sku' => 'SZ-TARGET']);

        $this->makeProduct([
            'parent_sku' => 'SZ-UKURAN-SAMA-POLOS',
            'design_variant' => 'POLOS',
            'height_cm' => 180,
            'width_cm' => 130,
        ]);
        $this->makeProduct([
            'parent_sku' => 'SZ-DESAIN-SAMA-BEDA-UKURAN',
            'design_variant' => 'ORNAMEN',
            'height_cm' => 80,
            'width_cm' => 80,
        ]);

        $order = $this->skusInOrder($this->recommendationsFor($target));

        $this->assertSame('SZ-UKURAN-SAMA-POLOS', $order[0], 'Ukuran sama menang atas desain setipe.');
        $this->assertContains('SZ-DESAIN-SAMA-BEDA-UKURAN', $order);
    }

    public function test_tinggi_sama_dengan_selisih_panjang_kecil_mendahului_ukuran_lain(): void
    {
        $target = $this->makeProduct(['parent_sku' => 'SZ-TINGGI-TARGET']);

        // Tinggi sama (180), panjang berselisih 30.
        $this->makeProduct([
            'parent_sku' => 'SZ-TINGGI-SAMA',
            'height_cm' => 180,
            'width_cm' => 160,
        ]);
        // Panjang sama (130) tapi tinggi jauh berbeda.
        $this->makeProduct([
            'parent_sku' => 'SZ-PANJANG-SAMA',
            'height_cm' => 100,
            'width_cm' => 130,
        ]);

        $order = $this->skusInOrder($this->recommendationsFor($target));

        $this->assertSame('SZ-TINGGI-SAMA', $order[0], 'Tinggi sama harus lebih dulu.');
        $this->assertSame('SZ-PANJANG-SAMA', $order[1]);
    }

    public function test_selisih_tinggi_mendahului_panjang_walau_panjangnya_identik(): void
    {
        // Kontrak owner 2026-09-16: tinggi LEBIH DOMINAN daripada panjang.
        // Kandidat dengan selisih tinggi kecil harus menang walau panjangnya
        // tidak sama, mengalahkan kandidat yang panjangnya identik tapi
        // tingginya berselisih jauh (kasus nyata di katalog produksi).
        $target = $this->makeProduct([
            'parent_sku' => 'SZ-DOMINAN-TARGET',
            'height_cm' => 180,
            'width_cm' => 130,
        ]);

        // dh=10, dw=50
        $this->makeProduct([
            'parent_sku' => 'SZ-TINGGI-DEKAT',
            'height_cm' => 170,
            'width_cm' => 80,
        ]);
        // dh=50, dw=0 (panjang identik)
        $this->makeProduct([
            'parent_sku' => 'SZ-PANJANG-IDENTIK',
            'height_cm' => 130,
            'width_cm' => 130,
        ]);

        $order = $this->skusInOrder($this->recommendationsFor($target));

        $this->assertSame(
            'SZ-TINGGI-DEKAT',
            $order[0],
            'Selisih tinggi kecil harus menang atas panjang yang identik.'
        );
        $this->assertSame('SZ-PANJANG-IDENTIK', $order[1]);
    }

    public function test_tinggi_sama_tapi_panjang_beda_jauh_tidak_menang(): void
    {
        // Kontrak owner 2026-09-16: "180x130 vs 180x220 terlalu drastis".
        // Tinggi yang sama TIDAK cukup untuk menang bila panjangnya beda jauh;
        // kandidat yang lebih dekat secara keseluruhan harus didahulukan.
        $target = $this->makeProduct([
            'parent_sku' => 'SZ-DRASTIS-TARGET',
            'height_cm' => 180,
            'width_cm' => 130,
        ]);

        // Tinggi sama persis, tapi panjang beda 90cm -> jarak 90.
        $this->makeProduct([
            'parent_sku' => 'SZ-TINGGI-SAMA-PANJANG-JAUH',
            'height_cm' => 180,
            'width_cm' => 220,
        ]);
        // Lebih dekat secara keseluruhan -> jarak (2x10)+10 = 30.
        $this->makeProduct([
            'parent_sku' => 'SZ-DEKAT-MENYELURUH',
            'height_cm' => 170,
            'width_cm' => 140,
        ]);

        $order = $this->skusInOrder($this->recommendationsFor($target));

        $this->assertSame(
            'SZ-DEKAT-MENYELURUH',
            $order[0],
            'Kandidat yang lebih dekat menang atas tinggi-sama-panjang-jauh.'
        );
        $this->assertSame('SZ-TINGGI-SAMA-PANJANG-JAUH', $order[1]);
    }

    public function test_panjang_lebih_dekat_diutamakan_bila_tinggi_sama_sama_tidak_cocok(): void
    {
        $target = $this->makeProduct(['parent_sku' => 'SZ-LEBAR-TARGET']);

        // Keduanya tinggi beda; yang panjangnya lebih dekat harus lebih dulu.
        $this->makeProduct(['parent_sku' => 'SZ-LEBAR-DEKAT', 'height_cm' => 100, 'width_cm' => 140]);
        $this->makeProduct(['parent_sku' => 'SZ-LEBAR-JAUH', 'height_cm' => 100, 'width_cm' => 220]);

        $order = $this->skusInOrder($this->recommendationsFor($target));

        $this->assertSame('SZ-LEBAR-DEKAT', $order[0]);
        $this->assertSame('SZ-LEBAR-JAUH', $order[1]);
    }

    public function test_model_sama_mendahului_ukuran_sama_lintas_model(): void
    {
        $target = $this->makeProduct(['parent_sku' => 'SZ-MODEL-TARGET']);

        // Ukuran identik tapi model berbeda (JUNGKIT vs SWING).
        $this->makeProduct([
            'parent_sku' => 'SZ-LINTAS-MODEL',
            'product_model' => 'JUNGKIT_2_DAUN',
            'height_cm' => 180,
            'width_cm' => 130,
        ]);
        // Model sama (SWING) tapi ukuran jauh.
        $this->makeProduct([
            'parent_sku' => 'SZ-MODEL-SAMA-JAUH',
            'height_cm' => 80,
            'width_cm' => 80,
        ]);

        $order = $this->skusInOrder($this->recommendationsFor($target));

        // Prioritas 1 (model sama) tetap di atas ukuran sama lintas model.
        $this->assertSame('SZ-MODEL-SAMA-JAUH', $order[0]);
        $this->assertSame('SZ-LINTAS-MODEL', $order[1]);
    }

    public function test_produk_tanpa_ukuran_tetap_dapat_rekomendasi(): void
    {
        // Ukuran null: pengurutan ukuran harus dilewati tanpa error.
        $target = $this->makeProduct([
            'parent_sku' => 'SZ-NULL-TARGET',
            'height_cm' => null,
            'width_cm' => null,
        ]);
        $this->makeProduct(['parent_sku' => 'SZ-NULL-1']);
        $this->makeProduct(['parent_sku' => 'SZ-NULL-2', 'design_variant' => 'POLOS']);

        $result = $this->recommendationsFor($target);

        $this->assertCount(2, $result['products']);
        $this->assertNotNull($result['url']);
    }

    public function test_maksimal_sepuluh_kandidat(): void
    {
        $target = $this->makeProduct(['parent_sku' => 'SZ-MAX-TARGET']);

        for ($i = 0; $i < 15; $i++) {
            $this->makeProduct([
                'parent_sku' => 'SZ-MAX-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                'height_cm' => 180,
                'width_cm' => 130 + $i,
            ]);
        }

        $result = $this->recommendationsFor($target);

        $this->assertCount(10, $result['products']);
        $this->assertNotContains('SZ-MAX-TARGET', $this->skusInOrder($result));
    }

    public function test_lihat_semua_mengarah_ke_listing_berfilter_kategori_model_desain(): void
    {
        $target = $this->makeProduct(['parent_sku' => 'SZ-URL-TARGET', 'design_variant' => 'ORNAMEN']);
        $this->makeProduct(['parent_sku' => 'SZ-URL-1']);

        $result = $this->recommendationsFor($target);

        $this->assertSame('/products/jendela/swing-2-daun/ornamen', $result['url']);
    }

    public function test_tanpa_sub_model_url_lihat_semua_tanpa_segmen_desain(): void
    {
        $target = $this->makeProduct([
            'parent_sku' => 'SZ-NODESIGN-TARGET',
            'design_variant' => null,
        ]);
        $this->makeProduct(['parent_sku' => 'SZ-NODESIGN-1']);

        $result = $this->recommendationsFor($target);

        $this->assertSame('/products/jendela/swing-2-daun', $result['url']);
    }

    public function test_tanpa_rekomendasi_url_null_agar_section_disembunyikan(): void
    {
        // Satu-satunya produk visible = produk itu sendiri.
        $target = $this->makeProduct(['parent_sku' => 'SZ-EMPTY-ONLY']);

        $result = $this->recommendationsFor($target);

        $this->assertSame([], $result['products']);
        $this->assertNull($result['url'], 'Tanpa isi, frontend tidak merender section.');
    }
}
