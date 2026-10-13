<?php

namespace App\Observers;

use App\Models\ProductPriceLog;
use App\Models\ProductVariant;
use App\Support\ProductCache;

/**
 * Invalidate cache katalog/PDP saat varian berubah (harga/stok/status)
 * + catat price history (append-only) saat harga berubah.
 */
class ProductVariantObserver
{
    public function saved(ProductVariant $variant): void
    {
        if ($variant->product_id && $variant->product) {
            app(\App\Support\ProductSearchKeywordService::class)->generate($variant->product);
        }

        if ($variant->wasChanged('price')) {
            ProductPriceLog::create([
                'product_variant_id' => $variant->id,
                'price_before' => (float) $variant->getOriginal('price'),
                'price_after' => (float) $variant->price,
                'source' => 'manual',
                'changed_by_user_id' => optional(auth()->user())->id,
                'created_at' => now(),
            ]);
        }

        ProductCache::flushProducts();
    }

    public function deleted(ProductVariant $variant): void
    {
        ProductCache::flushProducts();
    }
}