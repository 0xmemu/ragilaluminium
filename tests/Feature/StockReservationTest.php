<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockReservation;
use App\Services\StockReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P2-3.2 — Stock reservation subsystem (aktif via config; OFF default).
 */
class StockReservationTest extends TestCase
{
    use RefreshDatabase;

    protected function makeVariant(int $stock = 10): ProductVariant
    {
        $p = Product::create([
            'parent_sku' => 'WIN-RS-1', 'name' => 'Window RS', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        return ProductVariant::create([
            'product_id' => $p->id, 'variant_sku' => 'WIN-RS-1-V1',
            'price' => 1000000, 'stock' => $stock, 'status' => 'active',
        ]);
    }

    public function test_disabled_by_default_no_op(): void
    {
        config(['operations.stock_reservation.enabled' => false]);

        $v = $this->makeVariant(10);
        $out = app(StockReservationService::class)->hold($v, 5);

        $this->assertTrue($out['ok']);
        $this->assertSame('disabled', $out['reason']);
        $this->assertSame(0, StockReservation::count());
    }

    public function test_hold_reduces_available_stock_and_release_restores(): void
    {
        config(['operations.stock_reservation.enabled' => true]);

        $v = $this->makeVariant(10);
        $svc = app(StockReservationService::class);

        $this->assertSame(10, $svc->availableStock($v));

        $out = $svc->hold($v, 4, 15, 'checkout', 1);
        $this->assertTrue($out['ok']);
        $this->assertSame(6, $svc->availableStock($v));

        // Over-reservation ditolak.
        $this->assertFalse($svc->hold($v, 7)['ok']);

        $svc->release($out['reservation']->id);
        $this->assertSame(10, $svc->availableStock($v));
    }

    public function test_expired_reservation_is_released(): void
    {
        config(['operations.stock_reservation.enabled' => true]);

        $v = $this->makeVariant(10);
        $svc = app(StockReservationService::class);

        $out = $svc->hold($v, 3, -1, 'checkout', 2); // sudah kedaluwarsa
        $this->assertTrue($out['ok']);

        $released = $svc->releaseExpired();
        $this->assertSame(1, $released);
        $this->assertSame('released', $out['reservation']->fresh()->status);
        $this->assertSame(10, $svc->availableStock($v));
    }
}