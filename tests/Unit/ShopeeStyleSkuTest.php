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

    public function test_next_parent_sku_is_ra_plus_10_random_chars_without_dashes(): void
    {
        $first = ShopeeStyleSku::nextParentSku();
        $second = ShopeeStyleSku::nextParentSku();

        // RA + 10 random chars = 12 chars, no dashes, opaque.
        $this->assertSame('RA', substr($first, 0, 2));
        $this->assertSame('RA', substr($second, 0, 2));
        $this->assertSame(12, strlen($first));
        $this->assertSame(12, strlen($second));
        $this->assertStringNotContainsString('-', $first);
        $alphabet = ShopeeStyleSku::RANDOM_ALPHABET;
        $this->assertSame(10, strspn(substr($first, 2), $alphabet));
        $this->assertSame(10, strspn(substr($second, 2), $alphabet));
        $this->assertNotSame($first, $second);
    }

    public function test_next_parent_sku_is_unique_globally(): void
    {
        $occupied = 'RA'.str_repeat('2', 10);
        Product::create([
            'parent_sku' => $occupied,
            'name' => 'Occupied',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $manual = ShopeeStyleSku::nextParentSku();

        $this->assertStringStartsWith('RA', $manual);
        $this->assertSame(12, strlen($manual));
        $this->assertStringNotContainsString('-', $manual);
        $this->assertNotSame($occupied, $manual);
    }

    public function test_next_variant_sku_is_ra_plus_6_to_8_random_no_dash_independent_of_parent(): void
    {
        $product = Product::create([
            'parent_sku' => 'RAABCDEFGH1',
            'name' => 'Test',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        foreach (range(1, 20) as $i) {
            $sku = ShopeeStyleSku::nextVariantSku($product);
            ProductVariant::create([
                'product_id' => $product->id,
                'variant_sku' => $sku,
                'price' => 1000000,
                'stock' => 1,
                'status' => 'active',
            ]);

            $this->assertStringStartsWith('RA', $sku);
            $this->assertStringNotContainsString('-', $sku);
            $tokenLen = strlen($sku) - 2;
            $this->assertGreaterThanOrEqual(6, $tokenLen, 'variant random token too short');
            $this->assertLessThanOrEqual(8, $tokenLen, 'variant random token too long');
            // Independent: never derived from the parent SKU.
            $this->assertNotSame($product->parent_sku, $sku);
        }
    }

    public function test_format_variant_sku_matches_shopee_import_rules_legacy(): void
    {
        // Legacy Shopee format stays unchanged (SP{n}, SP{n}-{variation}).
        $this->assertSame('SP123', ShopeeStyleSku::formatVariantSku('SP123'));
        $this->assertSame('SP123-456', ShopeeStyleSku::formatVariantSku('SP123', '456'));
        $this->assertSame('SP123-CUSTOM', ShopeeStyleSku::formatVariantSku('SP123', '456', 'SP123-CUSTOM'));
    }
}
