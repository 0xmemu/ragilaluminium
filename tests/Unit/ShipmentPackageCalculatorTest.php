<?php

namespace Tests\Unit;

use App\Services\Shipping\ShipmentPackageCalculator;
use PHPUnit\Framework\TestCase;

class ShipmentPackageCalculatorTest extends TestCase
{
    public function test_pallet_and_volumetric_weight_win_for_40_by_100_product(): void
    {
        $calculator = new ShipmentPackageCalculator(3, 5000, 3);
        $result = $calculator->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 1,
        ]]);

        $this->assertSame(106.0, $result['length_cm']);
        $this->assertSame(21.0, $result['width_cm']);
        $this->assertSame(46.0, $result['height_cm']);
        $this->assertSame(20.479, $result['volumetric_weight_kg']);
        $this->assertSame(20.479, $result['chargeable_weight_kg']);
    }

    public function test_same_package_adds_width_for_two_units(): void
    {
        $result = (new ShipmentPackageCalculator(3, 5000, 3))->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 2,
        ]]);

        $this->assertSame(36.0, $result['width_cm']);
        $this->assertSame(17.6, $result['actual_weight_kg']);
    }
}
