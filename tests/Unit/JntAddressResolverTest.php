<?php

namespace Tests\Unit;

use App\Models\JntAddressMaster;
use App\Support\JntAddressResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JntAddressResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_jnt_town_resolves_to_parent_area_for_tariff_payload(): void
    {
        JntAddressMaster::create([
            'province_name' => 'Jawa Timur',
            'city_name' => 'Kota Batu',
            'area_name' => 'Batu',
            'town_name' => 'Temas',
            'province_key' => 'JAWA TIMUR',
            'city_key' => 'KOTA BATU',
            'area_key' => 'BATU',
            'town_key' => 'TEMAS',
            'synced_at' => now(),
        ]);

        $resolved = app(JntAddressResolver::class)->resolve('JAWA TIMUR', 'KOTA BATU', 'TEMAS');

        $this->assertSame('verified', $resolved['status']);
        $this->assertSame('Batu', $resolved['area_name']);
        $this->assertSame('Temas', $resolved['town_name']);
    }

    public function test_jnt_resolves_kabupaten_prefix_and_unspaced_district(): void
    {
        JntAddressMaster::create([
            'province_name' => 'Jawa Tengah',
            'city_name' => 'Kab Karanganyar',
            'area_name' => 'Kebak Kramat',
            'town_name' => '',
            'province_key' => 'JAWA TENGAH',
            'city_key' => 'KAB KARANGANYAR',
            'area_key' => 'KEBAK KRAMAT',
            'town_key' => '',
            'synced_at' => now(),
        ]);

        $resolved = app(JntAddressResolver::class)->resolve('JAWA TENGAH', 'KABUPATEN KARANGANYAR', 'KEBAKKRAMAT');

        $this->assertSame('verified', $resolved['status']);
        $this->assertSame('Kab Karanganyar', $resolved['city_name']);
        $this->assertSame('Kebak Kramat', $resolved['area_name']);
    }
}
