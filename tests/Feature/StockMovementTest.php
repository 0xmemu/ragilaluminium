<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Support\StockLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P2-3.1 — Stock movement audit trail.
 */
class StockMovementTest extends TestCase
{
    use RefreshDatabase;

    protected function makeVariant(int $stock = 10): ProductVariant
    {
        $p = Product::create([
            'parent_sku' => 'WIN-SM-1', 'name' => 'Window SM', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        return ProductVariant::create([
            'product_id' => $p->id, 'variant_sku' => 'WIN-SM-1-V1',
            'price' => 1000000, 'stock' => $stock, 'status' => 'active',
        ]);
    }

    public function test_decrement_records_movement_with_before_after(): void
    {
        $v = $this->makeVariant(10);

        StockLedger::apply($v, -3, 'order_out', 'order', 99);

        $this->assertSame(7, $v->fresh()->stock);

        $m = StockMovement::where('product_variant_id', $v->id)->first();
        $this->assertNotNull($m);
        $this->assertSame(10, (int) $m->stock_before);
        $this->assertSame(7, (int) $m->stock_after);
        $this->assertSame(-3, (int) $m->quantity);
        $this->assertSame('order_out', $m->movement_type);
        $this->assertSame('order', $m->reference_type);
        $this->assertSame(99, (int) $m->reference_id);
    }

    public function test_increment_records_movement(): void
    {
        $v = $this->makeVariant(2);

        StockLedger::apply($v, 5, 'order_cancel_in', 'order', 7);

        $this->assertSame(7, $v->fresh()->stock);
        $m = StockMovement::where('product_variant_id', $v->id)->first();
        $this->assertSame(2, (int) $m->stock_before);
        $this->assertSame(7, (int) $m->stock_after);
        $this->assertSame(5, (int) $m->quantity);
    }

    public function test_ledger_is_append_only_and_never_double_counts(): void
    {
        $v = $this->makeVariant(10);

        StockLedger::apply($v, -1, 'manual');
        StockLedger::apply($v, -2, 'order_out', 'order', 1);
        StockLedger::apply($v, 4, 'order_cancel_in', 'order', 1);

        $this->assertSame(11, $v->fresh()->stock);
        $this->assertSame(3, StockMovement::where('product_variant_id', $v->id)->count());
    }
}