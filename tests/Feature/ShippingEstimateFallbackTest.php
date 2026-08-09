<?php

namespace Tests\Feature;

use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShippingEstimateFallbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_estimate_uses_local_formula_when_jnt_disabled(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(false);
            $mock->shouldNotReceive('tariff');
        });

        $result = app(ShippingService::class)->estimateBreakdown(2.0, 'KOTA BANDUNG', 'JAWA BARAT');

        $this->assertEquals(15000 + 2 * 2000, $result['net']);
        $this->assertEquals(15000 + 2 * 2000, $result['gross']);
        $this->assertFalse($result['applied']);
        $this->assertSame('jnt', $result['carrier']);
    }

    public function test_estimate_falls_back_to_local_formula_when_jnt_api_fails(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andThrow(new \RuntimeException('J&T API unreachable'));
        });

        $result = app(ShippingService::class)->estimateBreakdown(3.5, 'KOTA BANDUNG', 'JAWA BARAT');

        // Fallback lokal: base_rate + (berat * per_kg) = 15000 + (3.5 * 2000).
        $this->assertSame(22000.0, $result['net']);
        $this->assertSame(22000.0, $result['gross']);
        $this->assertFalse($result['applied']);
    }

    public function test_estimate_uses_jnt_tariff_when_available(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => ['estimateSumFreight' => 42000]],
                requestId: 'req-1',
                elapsedMs: 120,
            ));
        });

        $result = app(ShippingService::class)->estimateBreakdown(2.0, 'KOTA BANDUNG', 'JAWA BARAT', '40132');

        $this->assertSame(42000.0, $result['gross']);
        $this->assertSame('jnt', $result['carrier']);
    }
}
