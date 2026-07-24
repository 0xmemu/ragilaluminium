<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;

class WilayahApiTest extends \Tests\TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $createdFixtures = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureWilayahDataset();
    }

    protected function tearDown(): void
    {
        foreach ($this->createdFixtures as $path) {
            @unlink($path);
        }
        $this->createdFixtures = [];

        parent::tearDown();
    }

    /**
     * CI / lingkungan baru tidak punya dataset wilayah di storage/app/wilayah
     * (folder storage tidak di-commit). Tulis fixture kecil agar test hermetis.
     * Di mesin dengan dataset asli (mis. VPS), fixture dilewati sepenuhnya.
     * Urutan provinsi fixture: baris pertama punya rantai regency->district->village
     * lengkap karena test cascading memakai provinces[0].
     */
    private function ensureWilayahDataset(): void
    {
        $dir = storage_path('app/wilayah');

        if (is_readable($dir.'/provinces.csv')) {
            return; // dataset asli tersedia - jangan disentuh
        }

        $files = [
            'provinces.csv' => "32,Jawa Barat\n33,Jawa Tengah\n",
            'regencies.csv' => "3201,32,Kabupaten Bogor\n3301,33,Kabupaten Banjarnegara\n",
            'districts.csv' => "320101,3201,Cibinong\n330101,3301,Mandiraja\n",
            'villages.csv' => "3201012001,320101,Pabuaran\n3301012001,330101,Mandiraja Wetan\n",
        ];

        File::ensureDirectoryExists($dir);
        foreach ($files as $name => $content) {
            $path = $dir.'/'.$name;
            if (! file_exists($path)) {
                file_put_contents($path, $content);
                $this->createdFixtures[] = $path;
            }
        }
    }

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
