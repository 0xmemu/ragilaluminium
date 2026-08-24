<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\ProductCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * P2-2.1 — Cache layer Catalog + PDP + invalidasi observer.
 */
class ProductCacheTest extends TestCase
{
    use RefreshDatabase;

    protected function makeProduct(): Product
    {
        $p = Product::create([
            'parent_sku' => 'WIN-CACHE-1', 'name' => 'Window Cache', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $p->id, 'variant_sku' => 'WIN-CACHE-1-V1',
            'price' => 1000000, 'stock' => 5, 'status' => 'active',
        ]);

        return $p;
    }

    public function test_pdp_is_cached_after_first_visit(): void
    {
        $this->makeProduct();

        $this->get(route('product.show', 'WIN-CACHE-1'))->assertOk();

        $this->assertTrue(Cache::tags(['products'])->has('pdp:WIN-CACHE-1'));
    }

    public function test_price_update_flushes_product_cache(): void
    {
        $p = $this->makeProduct();

        $this->get(route('product.show', 'WIN-CACHE-1'))->assertOk();
        $this->assertTrue(Cache::tags(['products'])->has('pdp:WIN-CACHE-1'));

        $p->activeVariants()->first()->update(['price' => 1500000]);

        $this->assertFalse(Cache::tags(['products'])->has('pdp:WIN-CACHE-1'));
    }

    public function test_remember_catalog_reuses_value_and_flush_recomputes(): void
    {
        $calls = 0;

        $a = ProductCache::rememberCatalog('k-1', function () use (&$calls) {
            $calls++;

            return 'A';
        });
        $b = ProductCache::rememberCatalog('k-1', function () {
            return 'B';
        });

        $this->assertSame('A', $a);
        $this->assertSame('A', $b, 'closure kedua tidak boleh dieksekusi (cache hit)');
        $this->assertSame(1, $calls);

        ProductCache::flushProducts();
        $c = ProductCache::rememberCatalog('k-1', function () use (&$calls) {
            $calls++;

            return 'C';
        });

        $this->assertSame('C', $c, 'setelah flush harus recompute');
        $this->assertSame(2, $calls);
    }
}