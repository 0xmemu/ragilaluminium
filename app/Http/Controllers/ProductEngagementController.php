<?php

namespace App\Http\Controllers;

use App\Events\ProductEngagementRecorded;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductEngagementController extends Controller
{
    public function store(Request $request, Product $product): JsonResponse
    {
        if ($product->status !== 'active') {
            abort(404);
        }

        $request->validate([
            'action' => ['required', 'string', 'in:click'],
        ]);

        // Async: engagement diproses queue (TrackProductEngagement) agar tidak
        // membebani response storefront.
        ProductEngagementRecorded::dispatch($product->id, $request->input('action'));

        return response()->json(['ok' => true]);
    }
}