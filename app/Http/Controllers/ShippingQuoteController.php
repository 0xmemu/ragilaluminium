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

        // Guard: berat 0 (keranjang tanpa data dimensi/berat valid) tidak
        // boleh 422 di frontend; quote() melakukan clamp >= 1 kg sendiri.
        $weightKg = max(0.01, (float) $validated['weight_kg']);

        // Nilai pertanggungan asuransi = subtotal baris yang dipilih, bukan
        // seluruh keranjang (bug 2026-09-14: asuransi ikut membengkak).
        $selectedLines = $this->cart->getSelectedLines();

        return response()->json([
            'data' => $this->shipping->quote(
                $weightKg,
                $validated['destination_city'],
                $validated['destination_province'] ?? null,
                $validated['postal_code'] ?? null,
                $validated['destination_area'] ?? null,
                $this->cart->subtotal($selectedLines !== [] ? $selectedLines : null),
            ),
        ]);
    }
}
