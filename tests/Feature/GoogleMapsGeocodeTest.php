<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleMapsGeocodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_google_geocode_normalizes_address_components_and_postal_code(): void
    {
        Config::set('services.google_maps.server_key', 'server-test-key');
        Http::fake([
            'https://maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'OK',
                'results' => [[
                    'place_id' => 'place-1',
                    'formatted_address' => 'Jl. A, Bandung, Indonesia',
                    'geometry' => ['location' => ['lat' => -6.9, 'lng' => 107.6]],
                    'address_components' => [
                        ['long_name' => 'Jawa Barat', 'types' => ['administrative_area_level_1']],
                        ['long_name' => 'Kota Bandung', 'types' => ['administrative_area_level_2']],
                        ['long_name' => 'Coblong', 'types' => ['administrative_area_level_3']],
                        ['long_name' => 'Dago', 'types' => ['administrative_area_level_4']],
                        ['long_name' => '40135', 'types' => ['postal_code']],
                    ],
                ]],
            ]),
        ]);

        $this->getJson('/api/maps/geocode?query=Dago%20Bandung')
            ->assertOk()
            ->assertJsonPath('state', 'ready')
            ->assertJsonPath('results.0.postal_code', '40135')
            ->assertJsonPath('results.0.city', 'Kota Bandung')
            ->assertJsonPath('results.0.village', 'Dago');
    }

    public function test_google_geocode_keeps_result_without_postal_code_explicitly_empty(): void
    {
        Config::set('services.google_maps.server_key', 'server-test-key');
        Http::fake([
            'https://maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'OK',
                'results' => [[
                    'formatted_address' => 'Indonesia',
                    'geometry' => ['location' => ['lat' => -6.2, 'lng' => 106.8]],
                    'address_components' => [],
                ]],
            ]),
        ]);

        $this->getJson('/api/maps/geocode?lat=-6.2&lon=106.8')
            ->assertOk()
            ->assertJsonPath('state', 'ready')
            ->assertJsonPath('results.0.postal_code', null);
    }

    public function test_google_geocode_failure_is_safe_and_does_not_return_provider_error(): void
    {
        Config::set('services.google_maps.server_key', 'server-test-key');
        Http::fake([
            'https://maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'REQUEST_DENIED',
                'error_message' => 'private provider detail',
                'results' => [],
            ]),
        ]);

        $this->getJson('/api/maps/geocode?query=Bandung')
            ->assertStatus(503)
            ->assertJsonPath('state', 'unavailable')
            ->assertJsonMissingPath('error_message');
    }

    public function test_google_geocode_is_unavailable_without_server_key(): void
    {
        Config::set('services.google_maps.server_key', null);

        $this->getJson('/api/maps/geocode?query=Bandung')
            ->assertStatus(503)
            ->assertJsonPath('state', 'unavailable');
    }
}
