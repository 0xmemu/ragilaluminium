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

        $this->assertDatabaseHas('product_variants', [
            'variant_sku' => $product->parent_sku,
            'price' => 1500000,
            'stock' => 5000,
            'status' => 'active',
        ]);
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

        // Varian pertama memakai parent ID; berikutnya parent + suffix acak 6 karakter.
        $this->assertDatabaseHas('product_variants', ['variant_sku' => $parentSku]);

        $suffixed = ProductVariant::query()
            ->where('product_id', $product->id)
            ->where('variant_sku', '!=', $parentSku)
            ->firstOrFail();

        $this->assertStringStartsWith($parentSku.'-', $suffixed->variant_sku);
        $this->assertSame(strlen($parentSku) + 7, strlen($suffixed->variant_sku));
        $this->assertSame(
            6,
            strspn(substr($suffixed->variant_sku, strlen($parentSku) + 1), ShopeeStyleSku::RANDOM_ALPHABET),
        );
    }
}
