<?php

namespace App\Observers;

use App\Models\ProductVariant;
use App\Support\ProductCache;

/**
 * Invalidate cache katalog/PDP saat varian berubah (harga/stok/status).
 */
class ProductVariantObserver
{
    public function saved(ProductVariant $variant): void
    {
        ProductCache::flushProducts();
    }

    public function deleted(ProductVariant $variant): void
    {
        ProductCache::flushProducts();
    }
}