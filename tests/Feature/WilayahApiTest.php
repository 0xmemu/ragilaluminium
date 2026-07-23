<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;

class WilayahApiTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_provinces_endpoint_returns_options(): void
    {
        $response = $this->getJson('/api/wilayah/provinces');

        $response->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name']]]);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_provinces_filter_q_is_case_insensitive(): void
    {
        $response = $this->getJson('/api/wilayah/provinces?q=jawa');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertNotEmpty($names);
        foreach ($names as $name) {
            $this->assertStringContainsStringIgnoringCase('jawa', $name);
        }
    }

    public function test_cascading_regencies_districts_villages(): void
    {
        $provinces = $this->getJson('/api/wilayah/provinces')->json('data');
        $provinceId = $provinces[0]['id'];

        $regencies = $this->getJson("/api/wilayah/regencies/{$provinceId}")
            ->assertOk()
            ->json('data');
        $this->assertNotEmpty($regencies);
        $regencyId = $regencies[0]['id'];

        $districts = $this->getJson("/api/wilayah/districts/{$regencyId}")
            ->assertOk()
            ->json('data');
        $this->assertNotEmpty($districts);
        $districtId = $districts[0]['id'];

        $villages = $this->getJson("/api/wilayah/villages/{$districtId}")
            ->assertOk()
            ->json('data');
        $this->assertNotEmpty($villages);
        $this->assertArrayHasKey('id', $villages[0]);
        $this->assertArrayHasKey('name', $villages[0]);
    }
}
