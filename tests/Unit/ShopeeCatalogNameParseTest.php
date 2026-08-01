<?php

namespace Tests\Unit;

use App\Imports\ShopeeCatalogExport;
use App\Support\ShopeeCatalogTaxonomy;
use App\Support\ShopeeVariationAxes;
use ReflectionMethod;
use Tests\TestCase;

class ShopeeCatalogNameParseTest extends TestCase
{
    public function test_parse_dimensions_from_new_shopee_title_case(): void
    {
        $name = 'Jendela Aluminium 3 Daun Swing Casement Ornamen Tinggi 200 cm x Panjang 160 cm (200x160)';
        $import = new ShopeeCatalogExport(1);

        $dimensions = $this->invoke($import, 'parseDimensions', [$name]);
        $taxonomy = ShopeeCatalogTaxonomy::fromProductName($name);
        $short = $this->invoke($import, 'shortName', [$name]);

        $this->assertSame(200.0, $dimensions['height_cm']);
        $this->assertSame(160.0, $dimensions['width_cm']);
        $this->assertSame('WINDOW', $taxonomy['category']);
        $this->assertSame('SWING', $taxonomy['model']);
        $this->assertSame('ORNAMEN', $taxonomy['design']);
        $this->assertSame('200x160', $short);
    }

    public function test_jendela_jungkit_is_window_not_bouven(): void
    {
        $taxonomy = ShopeeCatalogTaxonomy::fromProductName(
            'Jendela 2 Daun Aluminium Jungkit Ornamen Tinggi 170 cm x Panjang 100 cm (170x100)'
        );

        $this->assertSame('WINDOW', $taxonomy['category']);
        $this->assertSame('JUNGKIT', $taxonomy['model']);
        $this->assertSame('ORNAMEN', $taxonomy['design']);
    }

    public function test_jendela_boven_jungkit_is_bouven_not_window(): void
    {
        $taxonomy = ShopeeCatalogTaxonomy::fromProductName(
            'Jendela Boven Aluminium Jungkit Ornamen (TxP) 50x50,50x60'
        );

        $this->assertSame('BOUVEN', $taxonomy['category']);
        $this->assertSame('JUNGKIT', $taxonomy['model']);
        $this->assertSame('ORNAMEN', $taxonomy['design']);
    }

    public function test_plain_boven_jungkit_is_bouven(): void
    {
        $taxonomy = ShopeeCatalogTaxonomy::fromProductName(
            'Tinggi 40 cm x Panjang 40 cm (40x40) Boven 1 Daun Aluminium Jungkit Polos'
        );

        $this->assertSame('BOUVEN', $taxonomy['category']);
        $this->assertSame('JUNGKIT', $taxonomy['model']);
        $this->assertSame('POLOS', $taxonomy['design']);
    }

    public function test_parse_dimensions_falls_back_to_paren_compact(): void
    {
        $name = 'Jendela Sliding Polos (120x80)';
        $import = new ShopeeCatalogExport(1);

        $dimensions = $this->invoke($import, 'parseDimensions', [$name]);

        $this->assertSame(120.0, $dimensions['height_cm']);
        $this->assertSame(80.0, $dimensions['width_cm']);
    }

    public function test_door_variation_uses_opening_and_color_glass_axes(): void
    {
        $axes = ShopeeVariationAxes::fromVariationName('Buka Kanan,Serat Kayu KcaBening');

        $this->assertSame('Arah Buka', $axes['variation_1_name']);
        $this->assertSame('Buka Kanan', $axes['variation_1_option']);
        $this->assertSame('Warna & Kaca', $axes['variation_2_name']);
        $this->assertSame('Serat Kayu Kaca Bening', $axes['variation_2_option']);
    }

    public function test_window_variation_keeps_warna_and_kaca(): void
    {
        $axes = ShopeeVariationAxes::fromVariationName('Putih,Kaca Riben');

        $this->assertSame('Warna', $axes['variation_1_name']);
        $this->assertSame('Putih', $axes['variation_1_option']);
        $this->assertSame('Kaca', $axes['variation_2_name']);
        $this->assertSame('Kaca Riben', $axes['variation_2_option']);
    }

    /** @param  list<mixed>  $args */
    protected function invoke(object $target, string $method, array $args = []): mixed
    {
        $ref = new ReflectionMethod($target, $method);
        $ref->setAccessible(true);

        return $ref->invokeArgs($target, $args);
    }
}
