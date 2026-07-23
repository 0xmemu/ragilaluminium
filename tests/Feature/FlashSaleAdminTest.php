<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FlashSaleAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_enable_and_disable_flash_sale(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = Product::create([
            'parent_sku' => 'WIN-FLASH-1',
            'name' => 'Jendela Flash',
            'short_name' => 'Flash',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-FLASH-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.flash-sale.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/FlashSale/Index'));

        $this->actingAs($admin)
            ->post(route('admin.flash-sale.store'), [
                'product_id' => $product->id,
                'flash_sale' => true,
                'compare_price' => 1250000,
            ])
            ->assertRedirect(route('admin.flash-sale.index'));

        $this->assertDatabaseHas('product_attributes', [
            'product_id' => $product->id,
            'attribute_name' => 'promo_flash_sale',
            'attribute_value' => 'true',
            'source' => 'internal',
        ]);
        $this->assertDatabaseHas('product_attributes', [
            'product_id' => $product->id,
            'attribute_name' => 'promo_compare_price',
            'attribute_value' => '1250000',
            'source' => 'internal',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.flash-sale.disable', $product))
            ->assertRedirect();

        $this->assertDatabaseHas('product_attributes', [
            'product_id' => $product->id,
            'attribute_name' => 'promo_flash_sale',
            'attribute_value' => 'false',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.flash-sale.enable', $product))
            ->assertRedirect();

        $this->assertTrue(
            ProductAttribute::query()
                ->where('product_id', $product->id)
                ->where('attribute_name', 'promo_flash_sale')
                ->where('attribute_value', 'true')
                ->exists()
        );
    }
}
