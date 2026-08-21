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

        // Nilai dari form (authoritative); preview checkout disinkronkan via
        // CheckoutController::validateDetails (route web, session tersedia).
        $withInsurance = $request->boolean('insurance');

        return response()->json([
            'data' => $this->shipping->quote(
                (float) $validated['weight_kg'],
                $validated['destination_city'],
                $validated['destination_province'] ?? null,
                $validated['postal_code'] ?? null,
                $validated['destination_area'] ?? null,
                $withInsurance,
            ),
        ]);
    }
}
