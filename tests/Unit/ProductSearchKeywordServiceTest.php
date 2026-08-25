<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\ProductSearchKeywordService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductSearchKeywordServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function product(array $overrides = []): Product
    {
        return Product::create(array_merge([
            'parent_sku' => 'RGL-TEST-'.uniqid(),
            'name' => 'Jendela Aluminium Jungkit Ornamen 200x180',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNEMEN',
            'status' => 'active',
        ], $overrides));
    }

    public function test_generate_short_name_dari_varian_berdimensi(): void
    {
        $product = $this->product();
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'V1',
            'height_cm' => 200.0,
            'width_cm' => 180.0,
            'price' => 1000,
            'stock' => 1,
            'status' => 'active',
        ]);

        app(ProductSearchKeywordService::class)->generate($product);

        $product->refresh();
        $this->assertSame('200x180', $product->short_name);
        $this->assertStringContainsString('jendela', $product->search_keywords);
        $this->assertStringContainsString('jungkit', $product->search_keywords);
    }

    public function test_tanpa_dimensi_short_name_null_keywords_terisi(): void
    {
        $product = $this->product(['name' => 'Aksesori Kunci Pintu Khusus']);
        app(ProductSearchKeywordService::class)->generate($product);
        $product->refresh();

        $this->assertNull($product->short_name, 'jangan mengarang short_name');
        $this->assertNotEmpty($product->search_keywords);
    }

    public function test_short_name_manual_admin_tidak_ditimpa(): void
    {
        $product = $this->product(['short_name' => 'JNG-ORN-200']);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'V2',
            'height_cm' => 200.0,
            'width_cm' => 180.0,
            'price' => 1000,
            'stock' => 1,
            'status' => 'active',
        ]);

        app(ProductSearchKeywordService::class)->generate($product);

        $this->assertSame('JNG-ORN-200', $product->fresh()->short_name);
    }

    public function test_regex_dimensi_dari_nama(): void
    {
        $product = $this->product(['name' => 'Pintu Lipat 100 cm x 220 cm Minimalis']);
        app(ProductSearchKeywordService::class)->generate($product);
        $product->refresh();

        $this->assertStringContainsString('100x220', $product->search_keywords);
    }
}