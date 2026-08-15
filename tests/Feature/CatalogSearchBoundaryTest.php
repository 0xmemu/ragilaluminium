<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\CatalogSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogSearchBoundaryTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, string>  $attributes
     */
    private function makeProduct(string $sku, string $name, array $attributes = []): Product
    {
        $product = Product::create(array_merge([
            'parent_sku' => $sku,
            'name' => $name,
            'short_name' => $name,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ], $attributes));

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-100',
            'price' => 800000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }

    /**
     * @return list<string>
     */
    private function searchSkus(string $term): array
    {
        $query = Product::query();
        CatalogSearch::apply($query, $term);

        return $query->pluck('parent_sku')->all();
    }

    public function test_percent_wildcard_is_literal_not_a_like_pattern(): void
    {
        $this->makeProduct('W1', 'Jendela Aluminium Sliding Polos');
        $this->makeProduct('W2', 'Pintu Minimalis Kaca');
        $this->makeProduct('W3', 'Jendela Diskon 100% Asli');

        $hits = $this->searchSkus('%');

        // q=% TIDAK boleh mencocokkan seluruh katalog — hanya nama yang mengandung % literal.
        $this->assertNotContains('W1', $hits);
        $this->assertNotContains('W2', $hits);
        $this->assertContains('W3', $hits);
    }

    public function test_underscore_wildcard_is_literal_and_does_not_match_all_models(): void
    {
        $this->makeProduct('U1', 'Jendela_Kaca_Matte');
        $this->makeProduct('U2', 'Jendela Kaca Polos');
        $this->makeProduct('U3', 'Pintu Swing Minimalis');

        $hits = $this->searchSkus('_');

        // Sebelum fix: "_" cocok dengan SEMUA kode model (semua mengandung underscore) —
        // q=_ mengembalikan hampir semua produk. Sekarang hanya literal underscore.
        $this->assertContains('U1', $hits);
        $this->assertNotContains('U2', $hits);
        $this->assertNotContains('U3', $hits);
    }

    public function test_plain_text_search_still_works(): void
    {
        $this->makeProduct('N1', 'Jendela Aluminium Sliding');
        $this->makeProduct('N2', 'Pintu Minimalis', ['product_category' => 'DOOR']);

        $hits = $this->searchSkus('jendela');

        $this->assertContains('N1', $hits);
        $this->assertNotContains('N2', $hits);
    }

    public function test_dimension_search_matches_reversed_pair(): void
    {
        $this->makeProduct('D1', 'Tinggi 100 x Panjang 50 cm Jendela Sliding');
        $this->makeProduct('D2', 'Jendela Jungkit 50 x 100 cm');
        $this->makeProduct('D3', 'Pintu 30 x 40 cm');

        $hits = $this->searchSkus('100x50');

        // 50x100 ikut tampil untuk pencarian 100x50, 30x40 tidak.
        $this->assertContains('D1', $hits);
        $this->assertContains('D2', $hits);
        $this->assertNotContains('D3', $hits);
    }

    public function test_dimension_search_does_not_match_substring_sizes(): void
    {
        // Regresi: pola lama "%W%x%H%" mencocokkan digit-substring — query "100x50"
        // ikut menampilkan "Tinggi 150 cm x Panjang 100 cm" karena "150"
        // mengandung "50". Ukuran lain (termasuk yang "mengandung" angka query)
        // TIDAK boleh tampil; hanya pasangan persis atau pasangan terbalik.
        $this->makeProduct('S1', 'Tinggi 100 cm x Panjang 50 cm Jendela Sliding');
        $this->makeProduct('S2', 'Tinggi 50 cm x Panjang 100 cm Boven Jungkit');
        $this->makeProduct('S3', 'Custom Tinggi 150 cm x Panjang 100 cm (150x100) Jendela Swing');
        $this->makeProduct('S5', 'Tinggi 250 cm x Panjang 50 cm Pintu Swing');
        $this->makeProduct('S6', 'Tinggi 100cm x Panjang 50cm Jendela Polos');
        $this->makeProduct('S7', 'Tinggi 50 cm x Panjang 200 cm (50x200) Boven Sliding');

        $hits = $this->searchSkus('100x50');

        $this->assertContains('S1', $hits);
        $this->assertContains('S2', $hits);
        $this->assertContains('S6', $hits);
        $this->assertNotContains('S3', $hits);
        $this->assertNotContains('S5', $hits);
        $this->assertNotContains('S7', $hits);

        // Pola literal lama "%50x100%" cocok dengan suffix "(150x100)" —
        // digit-substring juga berlaku pada pola literal. Guard isSizeTerm
        // harus menonaktifkan literal untuk size term murni.
        $hitsRev = $this->searchSkus('50x100');
        $this->assertContains('S2', $hitsRev);
        $this->assertNotContains('S3', $hitsRev);
    }

    public function test_taxonomy_combo_requires_both_model_and_category(): void
    {
        $this->makeProduct('C1', 'Sliding Kaca Mati', ['product_model' => 'SLIDING']);
        $this->makeProduct('C2', 'Jungkit Kaca Mati', ['product_model' => 'JUNGKIT']);
        $this->makeProduct('C3', 'Sliding Pintu', [
            'product_category' => 'DOOR',
            'product_model' => 'SLIDING',
        ]);

        $hits = $this->searchSkus('jendela sliding');

        $this->assertContains('C1', $hits);
        $this->assertNotContains('C2', $hits);
        $this->assertNotContains('C3', $hits);
    }

    public function test_very_long_query_is_bounded_and_does_not_error(): void
    {
        $this->makeProduct('L1', 'Jendela Aluminium Sliding');

        $hits = $this->searchSkus(str_repeat('a', 500));

        // Panjang dibatasi internal (120 char) — tidak ada exception, query tetap jalan.
        $this->assertIsArray($hits);
        $this->assertNotContains('L1', $hits);
    }

    public function test_empty_term_is_a_noop(): void
    {
        $this->makeProduct('E1', 'Jendela Aluminium Sliding');
        $this->makeProduct('E2', 'Pintu Minimalis');

        $hits = $this->searchSkus('');

        $this->assertContains('E1', $hits);
        $this->assertContains('E2', $hits);
    }
}
