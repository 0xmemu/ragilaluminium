<?php

namespace Tests\Unit;

use App\Services\Shipping\ShipmentPackageCalculator;
use Tests\TestCase;

class ShipmentPackageCalculatorTest extends TestCase
{
    public function test_pallet_and_volumetric_weight_win_for_40_by_100_product(): void
    {
        $calculator = new ShipmentPackageCalculator(3, 5000);
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
    /**
     * Pembagi volumetrik 5000 adalah RUMUS RESMI J&T Cargo, bukan angka
     * karangan sistem:
     *   - FAQ resmi jtcargo.id/problem/qa:
     *     "(Panjang x Lebar x Tinggi) X 1 Kg / 5000"
     *   - Kanal resmi @jtcargoid: "panjang kali lebar kali tinggi dibagi 5000"
     *
     * Jangan tertukar: J&T EXPRESS (help.jet.co.id) memakai /6000. Keduanya
     * entitas berbeda; kurir Ragil adalah J&T Cargo.
     *
     * Test ini mengunci nilai default supaya perubahan diam-diam ketahuan.
     */
    public function test_pembagi_volumetrik_5000_adalah_rumus_resmi_jnt_cargo(): void
    {
        $this->assertSame(
            5000.0,
            (float) config('shipping.volumetric_divisor'),
            'pembagi volumetrik wajib 5000 sesuai rumus resmi J&T Cargo'
        );

        // Contoh resmi: paket 50 x 60 x 30 cm -> volume 90.000 cm3.
        // Menurut rumus J&T Cargo: 90.000 / 5000 = 18 kg.
        $result = (new ShipmentPackageCalculator(0, 5000))->calculate([[
            'weight_kg' => 1.0,
            'height_cm' => 30,
            'length_cm' => 50,
            'width_cm' => 60,
            'quantity' => 1,
        ]]);

        $this->assertSame(90000.0, $result['volume_cm3']);
        $this->assertSame(18.0, $result['volumetric_weight_kg'], '90.000 / 5000 = 18 kg');
        $this->assertSame(18.0, $result['chargeable_weight_kg'], 'volumetrik menang atas berat aktual');
    }

    /**
     * Berat tagih = mana yang lebih besar (berat aktual vs volumetrik),
     * sesuai praktik J&T Cargo.
     */
    public function test_berat_tagih_memakai_yang_terbesar(): void
    {
        // Berat aktual menang.
        $beratMenang = (new ShipmentPackageCalculator(0, 5000))->calculate([[
            'weight_kg' => 50.0,
            'height_cm' => 30,
            'length_cm' => 50,
            'width_cm' => 60,
            'quantity' => 1,
        ]]);
        $this->assertSame(18.0, $beratMenang['volumetric_weight_kg']);
        $this->assertSame(50.0, $beratMenang['chargeable_weight_kg'], 'berat aktual lebih besar');

        // Volumetrik menang.
        $volMenang = (new ShipmentPackageCalculator(0, 5000))->calculate([[
            'weight_kg' => 2.0,
            'height_cm' => 30,
            'length_cm' => 50,
            'width_cm' => 60,
            'quantity' => 1,
        ]]);
        $this->assertSame(18.0, $volMenang['chargeable_weight_kg'], 'volumetrik lebih besar');
    }


    public function test_default_constructor_uses_zero_allowance_and_metode_a(): void
    {
        $calculator = new ShipmentPackageCalculator();
        $result = $calculator->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 1,
        ]]);

        // Tanpa tambahan packing kayu (+6cm): dimensi persis sama dengan ukuran produk
        $this->assertSame(100.0, $result['length_cm']);
        $this->assertSame(15.0, $result['width_cm']);
        $this->assertSame(40.0, $result['height_cm']);
        $this->assertSame(60000.0, $result['volume_cm3']);
        $this->assertSame(12.0, $result['volumetric_weight_kg']);
        $this->assertSame(12.0, $result['chargeable_weight_kg']);
        $this->assertSame(8.8, $result['actual_weight_kg']);
        $this->assertSame(1, $result['package_count']);
    }

    public function test_metode_a_menjumlahkan_volume_dan_berat_aktual_multi_produk(): void
    {
        // Item 1: Jendela 100 x 15 x 40 cm, 8.8 kg, qty 1 -> vol 60.000 cm3
        // Item 2: Boven 50 x 10 x 30 cm, 4.0 kg, qty 1 -> vol 15.000 cm3
        // Total volume = 75.000 cm3 -> volumetrik 15.0 kg
        // Total berat = 12.8 kg -> berat tagih 15.0 kg
        $calculator = new ShipmentPackageCalculator();
        $result = $calculator->calculate([
            [
                'weight_kg' => 8.8,
                'height_cm' => 40,
                'length_cm' => 100,
                'width_cm' => 15,
                'quantity' => 1,
            ],
            [
                'weight_kg' => 4.0,
                'height_cm' => 30,
                'length_cm' => 50,
                'width_cm' => 10,
                'quantity' => 1,
            ],
        ]);

        $this->assertSame(75000.0, $result['volume_cm3']);
        $this->assertSame(12.8, $result['actual_weight_kg']);
        $this->assertSame(15.0, $result['volumetric_weight_kg']);
        $this->assertSame(15.0, $result['chargeable_weight_kg']);
        $this->assertSame(100.0, $result['length_cm']);
        $this->assertSame(40.0, $result['height_cm']);
        $this->assertSame(18.75, $result['width_cm'], 'lebar efektif agar P x L x T = volume total');
        $this->assertSame(2, $result['package_count']);
    }

    public function test_metode_a_multi_quantity_produk_sama(): void
    {
        $calculator = new ShipmentPackageCalculator();
        $result = $calculator->calculate([[
            'weight_kg' => 8.8,
            'height_cm' => 40,
            'length_cm' => 100,
            'width_cm' => 15,
            'quantity' => 2,
        ]]);

        $this->assertSame(120000.0, $result['volume_cm3']);
        $this->assertSame(17.6, $result['actual_weight_kg']);
        $this->assertSame(24.0, $result['volumetric_weight_kg']);
        $this->assertSame(24.0, $result['chargeable_weight_kg']);
        $this->assertSame(100.0, $result['length_cm']);
        $this->assertSame(30.0, $result['width_cm']);
        $this->assertSame(40.0, $result['height_cm']);
        $this->assertSame(2, $result['package_count']);
    }
}
