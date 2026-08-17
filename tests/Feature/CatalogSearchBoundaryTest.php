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

    public function test_typo_slidding_matches_sliding(): void
    {
        $this->makeProduct('T1', 'Jendela Aluminium Sliding Polos');
        $this->makeProduct('T2', 'Jendela Aluminium Jungkit Polos', ['product_model' => 'JUNGKIT']);

        $hits = $this->searchSkus('jendela slidding');

        $this->assertContains('T1', $hits);
        $this->assertNotContains('T2', $hits);
    }

    public function test_synonym_bouven_matches_boven(): void
    {
        $this->makeProduct('BY1', 'Boven Aluminium Jungkit Polos', [
            'product_category' => 'BOUVEN',
            'product_model' => 'JUNGKIT',
        ]);
        $this->makeProduct('BY2', 'Jendela Aluminium Jungkit Polos', ['product_model' => 'JUNGKIT']);

        $hits = $this->searchSkus('bouven jungkit');

        $this->assertContains('BY1', $hits);
        $this->assertNotContains('BY2', $hits);
    }

    public function test_synonym_geser_and_ayun_map_to_models(): void
    {
        $this->makeProduct('G1', 'Pintu Aluminium Sliding Polos', [
            'product_category' => 'DOOR',
            'product_model' => 'SLIDING',
        ]);
        $this->makeProduct('G2', 'Pintu Aluminium Swing Polos', [
            'product_category' => 'DOOR',
            'product_model' => 'SWING',
        ]);

        $hitsGeser = $this->searchSkus('pintu geser');
        $this->assertContains('G1', $hitsGeser);
        $this->assertNotContains('G2', $hitsGeser);

        $hitsAyun = $this->searchSkus('pintu ayun');
        $this->assertContains('G2', $hitsAyun);
        $this->assertNotContains('G1', $hitsAyun);
    }

    public function test_design_sequence_phrase_routes_to_real_design(): void
    {
        $this->makeProduct('SR1', 'Jendela Aluminium Jungkit Seri A', [
            'product_model' => 'JUNGKIT',
            'design_variant' => 'SERIES_A',
        ]);
        $this->makeProduct('SR2', 'Jendela Aluminium Jungkit Kombinasi', [
            'product_model' => 'JUNGKIT',
            'design_variant' => 'KOMBINASI',
        ]);

        $hits = $this->searchSkus('jendela seri a');

        $this->assertContains('SR1', $hits);
        $this->assertNotContains('SR2', $hits);
    }

    public function test_ambiguous_descriptor_does_not_create_vague_matches(): void
    {
        $this->makeProduct('M1', 'Jendela Aluminium Sliding Polos');
        $this->makeProduct('M2', 'Jendela Aluminium Jungkit Polos', ['product_model' => 'JUNGKIT']);

        $hits = $this->searchSkus('modern sliding');
        $this->assertContains('M1', $hits);
        $this->assertNotContains('M2', $hits);

        $hitsOnly = $this->searchSkus('modern');
        $this->assertNotContains('M1', $hitsOnly);
        $this->assertNotContains('M2', $hitsOnly);
    }

    public function test_ambiguous_word_still_matches_real_named_product(): void
    {
        $this->makeProduct('MN1', 'Pintu Minimalis Kaca Polos', ['product_category' => 'DOOR']);
        $this->makeProduct('MN2', 'Pintu Swing Polos', [
            'product_category' => 'DOOR',
            'product_model' => 'SWING',
        ]);

        $hits = $this->searchSkus('minimalis');

        $this->assertContains('MN1', $hits);
        $this->assertNotContains('MN2', $hits);
    }

    public function test_color_matches_only_official_variant_option(): void
    {
        $p = $this->makeProduct('CL1', 'Jendela Aluminium Sliding Polos');
        ProductVariant::create([
            'product_id' => $p->id,
            'variant_sku' => 'CL1-H',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Hitam',
            'price' => 900000,
            'stock' => 3,
            'status' => 'active',
        ]);
        $p2 = $this->makeProduct('CL2', 'Jendela Aluminium Jungkit Polos', ['product_model' => 'JUNGKIT']);
        ProductVariant::create([
            'product_id' => $p2->id,
            'variant_sku' => 'CL2-P',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'price' => 900000,
            'stock' => 3,
            'status' => 'active',
        ]);

        $hits = $this->searchSkus('sliding hitam');

        $this->assertContains('CL1', $hits);
        $this->assertNotContains('CL2', $hits);
    }

    public function test_invented_color_does_not_exist_in_catalog(): void
    {
        $p = $this->makeProduct('AB1', 'Jendela Aluminium Sliding Polos');
        ProductVariant::create([
            'product_id' => $p->id,
            'variant_sku' => 'AB1-H',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Hitam',
            'price' => 900000,
            'stock' => 3,
            'status' => 'active',
        ]);

        $hits = $this->searchSkus('abu doff');

        $this->assertNotContains('AB1', $hits);
    }

    public function test_official_color_values_only_from_db(): void
    {
        $p = $this->makeProduct('OC1', 'Jendela Aluminium Sliding Polos');
        ProductVariant::create([
            'product_id' => $p->id,
            'variant_sku' => 'OC1-1',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Biru Langit',
            'price' => 1,
            'stock' => 1,
            'status' => 'active',
        ]);

        $colors = CatalogSearch::officialColorValues();

        $this->assertContains('Biru Langit', $colors);
        $this->assertNotContains('Ungu', $colors);
    }

    public function test_dimension_range_matches_within_bounds_preserving_orientation(): void
    {
        $a = $this->makeProduct('RG1', 'Jendela A');
        ProductVariant::create(['product_id' => $a->id, 'variant_sku' => 'RG1-1', 'height_cm' => 82, 'width_cm' => 105, 'price' => 1, 'stock' => 1, 'status' => 'active']);
        $b = $this->makeProduct('RG2', 'Jendela B');
        ProductVariant::create(['product_id' => $b->id, 'variant_sku' => 'RG2-1', 'height_cm' => 80, 'width_cm' => 100, 'price' => 1, 'stock' => 1, 'status' => 'active']);
        $c = $this->makeProduct('RG3', 'Jendela C');
        ProductVariant::create(['product_id' => $c->id, 'variant_sku' => 'RG3-1', 'height_cm' => 85, 'width_cm' => 110, 'price' => 1, 'stock' => 1, 'status' => 'active']);
        $rev = $this->makeProduct('RG4', 'Jendela D');
        ProductVariant::create(['product_id' => $rev->id, 'variant_sku' => 'RG4-1', 'height_cm' => 100, 'width_cm' => 80, 'price' => 1, 'stock' => 1, 'status' => 'active']);
        $out = $this->makeProduct('RG5', 'Jendela E');
        ProductVariant::create(['product_id' => $out->id, 'variant_sku' => 'RG5-1', 'height_cm' => 86, 'width_cm' => 100, 'price' => 1, 'stock' => 1, 'status' => 'active']);

        $hits = $this->searchSkus('80x100 sampai 85x110');

        $this->assertContains('RG1', $hits);
        $this->assertContains('RG2', $hits);
        $this->assertContains('RG3', $hits);
        $this->assertNotContains('RG4', $hits);
        $this->assertNotContains('RG5', $hits);
    }

    public function test_dimension_range_alternate_separators(): void
    {
        $a = $this->makeProduct('RS1', 'Jendela A');
        ProductVariant::create(['product_id' => $a->id, 'variant_sku' => 'RS1-1', 'height_cm' => 81, 'width_cm' => 104, 'price' => 1, 'stock' => 1, 'status' => 'active']);

        foreach (['80x100 hingga 85x110', '80x100 - 85x110', '80x100 s/d 85x110'] as $q) {
            $this->assertContains('RS1', $this->searchSkus($q), "range query: $q");
        }
    }

    public function test_nearest_size_variants_ordered_by_distance(): void
    {
        $a = $this->makeProduct('NS1', 'Jendela A');
        ProductVariant::create(['product_id' => $a->id, 'variant_sku' => 'NS1-1', 'height_cm' => 100, 'width_cm' => 50, 'price' => 100, 'stock' => 1, 'status' => 'active']);
        $b = $this->makeProduct('NS2', 'Jendela B');
        ProductVariant::create(['product_id' => $b->id, 'variant_sku' => 'NS2-1', 'height_cm' => 95, 'width_cm' => 55, 'price' => 100, 'stock' => 1, 'status' => 'active']);
        $c = $this->makeProduct('NS3', 'Jendela C');
        ProductVariant::create(['product_id' => $c->id, 'variant_sku' => 'NS3-1', 'height_cm' => 60, 'width_cm' => 120, 'price' => 100, 'stock' => 1, 'status' => 'active']);

        $near = CatalogSearch::nearestSizeVariants(100, 50, 3);

        $this->assertSame('NS1-1', $near[0]['variant_sku']);
        $this->assertSame('NS2-1', $near[1]['variant_sku']);
        $this->assertSame('NS3-1', $near[2]['variant_sku']);
    }

}
