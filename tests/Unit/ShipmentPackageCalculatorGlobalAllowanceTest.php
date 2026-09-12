<?php

namespace Tests\Unit;

use App\Services\Shipping\ShipmentPackageCalculator;
use PHPUnit\Framework\TestCase;

class ShipmentPackageCalculatorGlobalAllowanceTest extends TestCase
{
    public function test_allowance_pallet_dipakai_seragam_dari_konstruktor(): void
    {
        $result = (new ShipmentPackageCalculator(3, 5000))->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 1,
        ]]);

        $this->assertSame(106.0, $result['length_cm']);
        $this->assertSame(21.0, $result['width_cm']);
        $this->assertSame(46.0, $result['height_cm']);
        $this->assertSame(8.8, $result['actual_weight_kg']);
    }

    public function test_field_pallet_per_produk_diabaikan(): void
    {
        // Field pallet per produk sudah dihapus; bila masih terkirim, harus diabaikan
        // dan nilai allowance dari konstruktor tetap yang dipakai.
        $result = (new ShipmentPackageCalculator(3, 5000))->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 1,
            'pallet_allowance_per_side_cm' => 4,
            'pallet_weight_kg' => 2.5,
        ]]);

        $this->assertSame(106.0, $result['length_cm']);
        $this->assertSame(21.0, $result['width_cm']);
        $this->assertSame(46.0, $result['height_cm']);
        $this->assertSame(8.8, $result['actual_weight_kg']);
    }

    public function test_dua_unit_menambah_lebar_tanpa_berat_pallet(): void
    {
        $result = (new ShipmentPackageCalculator(3, 5000))->calculate([[
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
