<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\ProductEngagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductEngagementController extends Controller
{
    public function store(Request $request, Product $product, ProductEngagementService $engagement): JsonResponse
    {
        if ($product->status !== 'active') {
            abort(404);
        }

        $request->validate([
            'action' => ['required', 'string', 'in:click'],
        ]);

        try {
            $engagement->trackClick($product->id);
        } catch (\Throwable) {
            // Never break storefront navigation on metrics failure.
        }

        return response()->json(['ok' => true]);
    }
}
