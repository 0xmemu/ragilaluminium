<?php

namespace Tests\Concerns;

use App\Models\Product;
use App\Models\ProductVariant;

/**
 * Produk storefront-visible: status active + minimal satu varian aktif
 * (scope Product::visible memerlukan keduanya).
 */
trait CreatesVisibleProducts
{
    protected function createVisibleProduct(array $overrides = []): Product
    {
        $product = Product::create(array_merge([
            'parent_sku' => 'VIS-' . strtoupper(uniqid()),
            'name' => 'Visible Sample',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ], $overrides));

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $product->parent_sku . '-V1',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return $product;
    }
}
