<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

class ProductVariantGalleryTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_pdp_media_includes_product_variant_id(): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-CLR-1',
            'name' => 'Window Colors',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $putih = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-CLR-1-PUTIH',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'height_cm' => 50,
            'width_cm' => 120,
            'price' => 100000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $hitam = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-CLR-1-HITAM',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Hitam',
            'price' => 110000,
            'stock' => 3,
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'product_variant_id' => $putih->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'stored_url' => 'https://cdn.example/putih.jpg',
            'status' => 'downloaded',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'product_variant_id' => $hitam->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'stored_url' => 'https://cdn.example/hitam.jpg',
            'status' => 'downloaded',
        ]);

        $this->get(route('product.show', 'WIN-CLR-1'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ProductDetail')
                ->has('media', 2)
                ->where('product.breadcrumbs.2.label', 'Ukuran 50 × 120 cm')
                ->where('media.0.product_variant_id', $putih->id)
                ->where('media.1.product_variant_id', $hitam->id)
            );
    }
}
