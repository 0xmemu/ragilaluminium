<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\ShopeeStyleSku;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShopeeStyleSkuTest extends TestCase
{
    use RefreshDatabase;

    public function test_next_parent_sku_is_opaque_random_with_prefix(): void
    {
        $prefix = ShopeeStyleSku::manualPrefix();

        $first = ShopeeStyleSku::nextParentSku();
        Product::create([
            'parent_sku' => $first,
            'name' => 'Allocated',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'draft',
        ]);
        $second = ShopeeStyleSku::nextParentSku();

        $this->assertTrue(str_starts_with($first, $prefix));
        $this->assertTrue(str_starts_with($second, $prefix));
        $this->assertSame(strlen($prefix) + 10, strlen($first));
        $this->assertSame(strlen($prefix) + 10, strlen($second));
        $alphabet = ShopeeStyleSku::RANDOM_ALPHABET;
        $this->assertTrue(strspn(substr($first, strlen($prefix)), $alphabet) === 10);
        $this->assertTrue(strspn(substr($second, strlen($prefix)), $alphabet) === 10);
        $this->assertNotSame($first, $second);
    }

    public function test_next_parent_sku_does_not_collide_with_shopee_sp_skus(): void
    {
        Product::create([
            'parent_sku' => 'SP24247818254',
            'name' => 'Shopee item',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $manual = ShopeeStyleSku::nextParentSku();

        $this->assertStringStartsWith('WEB', $manual);
        $this->assertNotSame('WEB1', $manual);
        $this->assertGreaterThan(strlen('WEB'), strlen($manual));
    }

    public function test_next_variant_sku_uses_parent_for_first_then_random_suffix(): void
    {
        $product = Product::create([
            'parent_sku' => 'WEBABCDEF12',
            'name' => 'Test',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $first = ShopeeStyleSku::nextVariantSku($product);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $first,
            'price' => 1000000,
            'stock' => 1,
            'status' => 'active',
        ]);

        $second = ShopeeStyleSku::nextVariantSku($product);

        $this->assertSame('WEBABCDEF12', $first);
        $this->assertTrue(str_starts_with($second, 'WEBABCDEF12-'));
        $this->assertSame(strlen('WEBABCDEF12-') + 6, strlen($second));
        $this->assertTrue(strspn(substr($second, strlen('WEBABCDEF12-')), ShopeeStyleSku::RANDOM_ALPHABET) === 6);
    }

    public function test_format_variant_sku_matches_shopee_import_rules(): void
    {
        $this->assertSame('SP123', ShopeeStyleSku::formatVariantSku('SP123'));
        $this->assertSame('SP123-456', ShopeeStyleSku::formatVariantSku('SP123', '456'));
        $this->assertSame('SP123-CUSTOM', ShopeeStyleSku::formatVariantSku('SP123', '456', 'SP123-CUSTOM'));
    }
}
