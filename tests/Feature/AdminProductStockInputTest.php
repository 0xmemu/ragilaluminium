<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\ShopeeStyleSku;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminProductStockInputTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_product_with_auto_generated_web_skus_and_initial_stock(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $response = $this->actingAs($admin)->post(route('admin.products.store'), [
            'name' => 'Jendela manual',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => false,
            'homepage_popular_sort' => 0,
            'create_initial_variant' => true,
            'randomize_stock' => false,
            'initial_price' => 1500000,
            'initial_stock' => 5000,
        ]);

        $response->assertRedirect(route('admin.products.index'));

        // Allocator kini menghasilkan public ID acak: {prefix}{10 karakter}.
        // (manual_sku_floor legacy era sequential - tidak dipakai lagi.)
        $prefix = ShopeeStyleSku::manualPrefix();
        $product = Product::where('name', 'Jendela manual')->firstOrFail();

        $this->assertStringStartsWith($prefix, $product->parent_sku);
        $this->assertSame(strlen($prefix) + 10, strlen($product->parent_sku));
        $this->assertSame(
            10,
            strspn(substr($product->parent_sku, strlen($prefix)), ShopeeStyleSku::RANDOM_ALPHABET),
        );

        // Varian awal punya SKU opak independen RA + 6..8 acak (tanpa dash),
        // diasosiasikan ke produk via product_id FK - tidak pernah sama dengan parent.
        $initial = ProductVariant::where('product_id', $product->id)->first();
        $this->assertNotNull($initial);
        $this->assertStringStartsWith(ShopeeStyleSku::WEBSITE_PREFIX, $initial->variant_sku);
        $this->assertStringNotContainsString('-', $initial->variant_sku);
        $this->assertNotSame($product->parent_sku, $initial->variant_sku);
        $tokenLen = strlen($initial->variant_sku) - strlen(ShopeeStyleSku::WEBSITE_PREFIX);
        $this->assertGreaterThanOrEqual(ShopeeStyleSku::VARIANT_RANDOM_MIN, $tokenLen);
        $this->assertLessThanOrEqual(ShopeeStyleSku::VARIANT_RANDOM_MAX, $tokenLen);
        $this->assertEquals(1500000, (float) $initial->price);
        $this->assertEquals(5000, (int) $initial->stock);
        $this->assertEquals('active', $initial->status);
    }

    public function test_admin_variant_store_auto_generates_unique_variant_sku(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $create = $this->actingAs($admin)->post(route('admin.products.store'), [
            'name' => 'Produk varian',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => false,
            'homepage_popular_sort' => 0,
            'create_initial_variant' => false,
        ]);
        $create->assertRedirect(route('admin.products.index'));

        $product = Product::where('name', 'Produk varian')->firstOrFail();
        $parentSku = $product->parent_sku;

        $this->actingAs($admin)->post(route('admin.products.variants.store', $product), [
            'variation_1_name' => 'Ukuran',
            'variation_1_option' => '100x120',
            'price' => 2000000,
            'stock' => 10,
            'status' => 'active',
        ])->assertRedirect(route('admin.products.variants.index', $product));

        $this->actingAs($admin)->post(route('admin.products.variants.store', $product), [
            'variation_1_name' => 'Ukuran',
            'variation_1_option' => '120x140',
            'price' => 2500000,
            'stock' => 5,
            'status' => 'active',
        ])->assertRedirect(route('admin.products.variants.index', $product));

        // Setiap varian: SKU opak independen RA + 6..8 acak (tanpa dash), tidak ada
        // yang sama dengan parent, asosiasi via product_id (bukan parse SKU).
        $variants = ProductVariant::query()
            ->where('product_id', $product->id)
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $variants);
        foreach ($variants as $variant) {
            $this->assertStringStartsWith(ShopeeStyleSku::WEBSITE_PREFIX, $variant->variant_sku);
            $this->assertStringNotContainsString('-', $variant->variant_sku);
            $this->assertNotSame($parentSku, $variant->variant_sku);
            $tokenLen = strlen($variant->variant_sku) - strlen(ShopeeStyleSku::WEBSITE_PREFIX);
            $this->assertGreaterThanOrEqual(ShopeeStyleSku::VARIANT_RANDOM_MIN, $tokenLen);
            $this->assertLessThanOrEqual(ShopeeStyleSku::VARIANT_RANDOM_MAX, $tokenLen);
        }
        $this->assertSame(
            2,
            ProductVariant::query()
                ->where('product_id', $product->id)
                ->distinct('variant_sku')
                ->count('variant_sku'),
        );
    }
}
