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

        // Pilihan asuransi pembeli disimpan ke session agar preview checkout
        // konsisten; place-order memakai nilai dari form (authoritative).
        $withInsurance = $request->boolean('insurance');
        $request->session()->put('checkout_insurance', $withInsurance);

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
