<?php

namespace Tests\Feature;

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

        $floor = (int) config('storefront.manual_sku_floor', 1);
        $expectedParentSku = ShopeeStyleSku::formatManualParentSku($floor);

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
            'initial_price' => 1500000,
            'initial_stock' => 5000,
        ]);

        $response->assertRedirect(route('admin.products.index'));
        $this->assertDatabaseHas('products', [
            'parent_sku' => $expectedParentSku,
        ]);
        $this->assertDatabaseHas('product_variants', [
            'variant_sku' => $expectedParentSku,
            'price' => 1500000,
            'stock' => 5000,
            'status' => 'active',
        ]);
        $this->assertStringStartsWith('WEB', $expectedParentSku);
    }

    public function test_admin_variant_store_auto_generates_unique_variant_sku(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $floor = (int) config('storefront.manual_sku_floor', 1);
        $parentSku = ShopeeStyleSku::formatManualParentSku($floor);

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

        $product = \App\Models\Product::where('parent_sku', $parentSku)->firstOrFail();

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

        $this->assertDatabaseHas('product_variants', ['variant_sku' => $parentSku]);
        $this->assertDatabaseHas('product_variants', ['variant_sku' => $parentSku.'-1']);
    }
}
