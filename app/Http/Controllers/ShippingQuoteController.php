<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShippingQuoteRequest;
use App\Services\CartService;
use App\Services\ShippingService;
use Illuminate\Http\JsonResponse;

class ShippingQuoteController extends Controller
{
    public function __construct(
        protected ShippingService $shipping,
        protected CartService $cart,
    ) {}

    public function store(ShippingQuoteRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // Nilai dari form (authoritative); preview checkout disinkronkan via
        // CheckoutController::validateDetails (route web, session tersedia).
        $withInsurance = $request->boolean('insurance');

        // Guard: berat 0 (keranjang tanpa data dimensi/berat valid) tidak
        // boleh 422 di frontend; quote() melakukan clamp >= 1 kg sendiri.
        $weightKg = max(0.01, (float) $validated['weight_kg']);

        return response()->json([
            'data' => $this->shipping->quote(
                $weightKg,
                $validated['destination_city'],
                $validated['destination_province'] ?? null,
                $validated['postal_code'] ?? null,
                $validated['destination_area'] ?? null,
                $withInsurance,
                $this->cart->subtotal(),
            ),
        ]);
    }
}
