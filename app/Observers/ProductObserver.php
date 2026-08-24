<?php

namespace App\Observers;

use App\Models\Product;
use App\Support\ProductCache;

/**
 * Invalidate cache katalog/PDP saat produk berubah (create/update/delete).
 */
class ProductObserver
{
    public function saved(Product $product): void
    {
        ProductCache::flushProducts();
    }

    public function deleted(Product $product): void
    {
        ProductCache::flushProducts();
    }
}