<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductPriceLog;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P2-2.3 — Price history append-only.
 */
class ProductPriceLogTest extends TestCase
{
    use RefreshDatabase;

    protected function makeVariant(): ProductVariant
    {
        $p = Product::create([
            'parent_sku' => 'WIN-PL-1', 'name' => 'Window PL', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        return ProductVariant::create([
            'product_id' => $p->id, 'variant_sku' => 'WIN-PL-1-V1',
            'price' => 1000000, 'stock' => 5, 'status' => 'active',
        ]);
    }

    public function test_price_update_creates_one_log_row(): void
    {
        $v = $this->makeVariant();

        $v->update(['price' => 1500000]);

        $log = ProductPriceLog::where('product_variant_id', $v->id)->first();
        $this->assertNotNull($log);
        $this->assertSame(1000000.0, (float) $log->price_before);
        $this->assertSame(1500000.0, (float) $log->price_after);
        $this->assertSame('manual', $log->source);
    }

    public function test_no_log_when_price_unchanged(): void
    {
        $v = $this->makeVariant();

        $v->update(['stock' => 7]);

        $this->assertSame(0, ProductPriceLog::where('product_variant_id', $v->id)->count());
    }

    public function test_log_history_is_append_only(): void
    {
        $v = $this->makeVariant();
        $v->update(['price' => 1100000]);
        $v->update(['price' => 1200000]);
        $v->update(['price' => 1000000]);

        $rows = ProductPriceLog::where('product_variant_id', $v->id)->orderBy('id')->get();
        $this->assertCount(3, $rows);
        $this->assertSame(1100000.0, (float) $rows[0]->price_after);
        $this->assertSame(1200000.0, (float) $rows[1]->price_after);
        $this->assertSame(1000000.0, (float) $rows[2]->price_after);
    }
}