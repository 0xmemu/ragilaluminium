<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShippingQuoteRequest;
use App\Services\ShippingService;
use Illuminate\Http\JsonResponse;

class ShippingQuoteController extends Controller
{
    public function __construct(protected ShippingService $shipping) {}

    public function store(ShippingQuoteRequest $request): JsonResponse
    {
        $validated = $request->validated();

        return response()->json([
            'data' => $this->shipping->quote(
                (float) $validated['weight_kg'],
                $validated['destination_city'],
                $validated['destination_province'] ?? null,
                $validated['postal_code'] ?? null,
                $validated['destination_area'] ?? null,
                $validated['village_id'] ?? null,
                $validated['village_name'] ?? null,
                $validated['district_id'] ?? null,
                $validated['district_name'] ?? null,
            ),
        ]);
    }
}
