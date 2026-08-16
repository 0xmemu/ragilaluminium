<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Support\CatalogLabels;
use App\Support\CategoryUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 3 — Dynamic taxonomy database: kategori berasal dari tabel `categories`
 * (bukan daftar tetap WINDOW/DOOR/BOUVEN) dan kategori baru langsung dipetakan
 * ke produk / navigasi / pencarian; kategori tak dikenal tidak fallback ke Jendela.
 */
class CatalogDynamicCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_admin_category_becomes_product_category_code_and_url(): void
    {
        $category = Category::query()->create([
            'code' => 'ATHAP',
            'name' => 'Athap Teralis',
            'slug' => 'athap-teralis',
            'sort_order' => 50,
            'is_active' => true,
        ]);

        $this->assertSame('ATHAP', CategoryUrl::codeToProductCode('ATHAP'));
        $this->assertContains('ATHAP', CategoryUrl::productCategoryCodes());

        $links = CategoryUrl::categoryLinks();
        $this->assertContains('athap-teralis', array_column($links, 'slug'));
        $this->assertContains('ATHAP', array_column($links, 'code'));

        $this->assertSame('ATHAP', CatalogLabels::normalizeCategory('ATHAP'));

        // Compatibility resolver: kategori Indonesia legacy tetap dipetakan ke
        // kode internal produk lama WINDOW/PINTU/BOVEN.
        $this->assertSame('WINDOW', CategoryUrl::codeToProductCode('JENDELA'));
        $this->assertSame('jendela', CategoryUrl::categoryToSlug('WINDOW'));
    }

    public function test_unknown_category_does_not_fallback_to_window(): void
    {
        $this->assertNull(CatalogLabels::normalizeCategory('GAWANG_X'));
        $this->assertSame('GAWANG_X', CategoryUrl::codeToProductCode('GAWANG_X'));

        $this->assertNotSame('jendela', CategoryUrl::categoryToSlug('GAWANG_X'));
        $this->assertSame('gawang_x', CategoryUrl::categoryToSlug('GAWANG_X'));
    }
}
