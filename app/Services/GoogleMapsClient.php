<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleMapsClient
{
    public function available(): bool
    {
        return filled(config('services.google_maps.server_key'));
    }

    public function search(string $query): array
    {
        return $this->request(['address' => $query.', Indonesia']);
    }

    public function reverse(float $latitude, float $longitude): array
    {
        return $this->request(['latlng' => $latitude.','.$longitude]);
    }

    private function request(array $parameters): array
    {
        if (! $this->available()) {
            return ['state' => 'unavailable', 'results' => []];
        }

        try {
            $response = Http::timeout((int) config('services.google_maps.timeout', 8))
                ->acceptJson()
                ->get((string) config('services.google_maps.geocode_url'), [
                    ...$parameters,
                    'key' => config('services.google_maps.server_key'),
                    'language' => config('services.google_maps.language', 'id'),
                    'region' => config('services.google_maps.region', 'id'),
                ]);
            if (! $response->successful()) {
                Log::warning('Google Maps geocoding HTTP failure', ['status' => $response->status()]);
                return ['state' => 'unavailable', 'results' => []];
            }

            $payload = $response->json();
            $status = (string) ($payload['status'] ?? 'UNKNOWN_ERROR');
            if ($status === 'ZERO_RESULTS') {
                return ['state' => 'not_found', 'results' => []];
            }
            if ($status !== 'OK') {
                Log::warning('Google Maps geocoding provider failure', ['provider_status' => $status]);
                return ['state' => 'unavailable', 'results' => []];
            }

            $results = array_values(array_filter(array_map(
                fn (mixed $result): ?array => is_array($result) ? $this->normalize($result) : null,
                is_array($payload['results'] ?? null) ? $payload['results'] : [],
            )));
            return ['state' => $results === [] ? 'not_found' : 'ready', 'results' => $results];
        } catch (\Throwable $exception) {
            Log::warning('Google Maps geocoding request failed', ['message' => $exception->getMessage()]);
            return ['state' => 'unavailable', 'results' => []];
        }
    }

    private function normalize(array $result): ?array
    {
        $location = data_get($result, 'geometry.location');
        $latitude = is_array($location) ? (float) ($location['lat'] ?? 0) : 0.0;
        $longitude = is_array($location) ? (float) ($location['lng'] ?? 0) : 0.0;
        if ($latitude === 0.0 && $longitude === 0.0) {
            return null;
        }

        $components = [];
        foreach (is_array($result['address_components'] ?? null) ? $result['address_components'] : [] as $component) {
            if (! is_array($component)) {
                continue;
            }
            foreach (is_array($component['types'] ?? null) ? $component['types'] : [] as $type) {
                $components[$type] ??= (string) ($component['long_name'] ?? '');
            }
        }

        // Maps is never a source of postal codes; postal codes come only from the
        // validated desa/kelurahan dataset. The geocode response carries context only.
        return [
            'place_id' => (string) ($result['place_id'] ?? ''),
            'display_name' => (string) ($result['formatted_address'] ?? ''),
            'lat' => $latitude,
            'lon' => $longitude,
            'province' => $components['administrative_area_level_1'] ?? null,
            'city' => $components['administrative_area_level_2'] ?? null,
            'district' => $components['administrative_area_level_3'] ?? $components['sublocality_level_1'] ?? null,
            'village' => $components['administrative_area_level_4'] ?? $components['sublocality'] ?? $components['sublocality_level_2'] ?? null,
            'address_components' => $components,
        ];
    }
}
