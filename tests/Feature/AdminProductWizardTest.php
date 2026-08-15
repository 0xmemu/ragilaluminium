<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminProductWizardTest extends TestCase
{
    use RefreshDatabase;

    public function test_wizard_creates_an_archived_product_and_returns_to_variant_step(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $response = $this->actingAs($admin)->post(route('admin.products.store'), [
            'workflow' => 'wizard',
            'name' => 'Jendela wizard',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'homepage_popular' => false,
        ]);

        $product = Product::where('name', 'Jendela wizard')->firstOrFail();

        $response->assertRedirect(route('admin.products.edit', [
            'product' => $product,
            'step' => 'variants',
        ]));
        $this->assertSame('archived', $product->status);
    }

    public function test_wizard_can_create_multiple_variants_in_one_submission(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = Product::create([
            'parent_sku' => 'WEB-WIZARD-1',
            'name' => 'Pintu wizard',
            'category_id' => 1,
            'product_category' => 'DOOR',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'archived',
        ]);

        $response = $this->actingAs($admin)->post(route('admin.products.variants.bulk', $product), [
            'wizard_step' => 'review',
            'variants' => [
                ['variation_1_name' => 'Ukuran', 'variation_1_option' => '80x200', 'price' => 1500000, 'stock' => 3, 'status' => 'active'],
                ['variation_1_name' => 'Ukuran', 'variation_1_option' => '90x210', 'price' => 1750000, 'stock' => 2, 'status' => 'active'],
            ],
        ]);

        $response->assertRedirect(route('admin.products.edit', [
            'product' => $product,
            'step' => 'review',
        ]));
        $this->assertSame(2, ProductVariant::where('product_id', $product->id)->count());
    }

    public function test_publish_requires_active_variant_and_ready_main_image(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = Product::create([
            'parent_sku' => 'WEB-WIZARD-2',
            'name' => 'Produk belum lengkap',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'archived',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.products.publish', $product))
            ->assertSessionHasErrors(['variants']);

        $this->assertSame('archived', $product->fresh()->status);
    }
}
