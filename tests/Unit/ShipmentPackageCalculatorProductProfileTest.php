<?php

namespace Tests\Unit;

use App\Services\Shipping\ShipmentPackageCalculator;
use PHPUnit\Framework\TestCase;

class ShipmentPackageCalculatorProductProfileTest extends TestCase
{
    public function test_product_profile_overrides_default_pallet_values(): void
    {
        $result = (new ShipmentPackageCalculator(3, 5000, 0))->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 1,
            'pallet_allowance_per_side_cm' => 4,
            'pallet_weight_kg' => 2.5,
        ]]);

        $this->assertSame(108.0, $result['length_cm']);
        $this->assertSame(23.0, $result['width_cm']);
        $this->assertSame(48.0, $result['height_cm']);
        $this->assertSame(11.3, $result['actual_weight_kg']);
        $this->assertSame(23.846, $result['volumetric_weight_kg']);
    }
}
