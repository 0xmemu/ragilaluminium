<?php

namespace App\Http\Controllers;

use App\Services\GoogleMapsClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoogleMapsController extends Controller
{
    public function __construct(protected GoogleMapsClient $maps) {}

    public function geocode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['nullable', 'string', 'min:3', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lon' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
        $hasQuery = filled($validated['query'] ?? null);
        $hasCoordinates = array_key_exists('lat', $validated) && array_key_exists('lon', $validated);
        if ($hasQuery === $hasCoordinates) {
            return response()->json(['state' => 'invalid', 'message' => 'Kirim query pencarian atau koordinat lokasi.', 'results' => []], 422);
        }
        $result = $hasQuery
            ? $this->maps->search((string) $validated['query'])
            : $this->maps->reverse((float) $validated['lat'], (float) $validated['lon']);
        return response()->json($result, $result['state'] === 'unavailable' ? 503 : 200);
    }
}
