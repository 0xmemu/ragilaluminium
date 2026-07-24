<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Support\CatalogSearch;
use App\Support\FlashSalePeriodSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    /**
     * JSON search API only (`GET /api/search`).
     * Storefront search uses `GET /products?q=` (CatalogController).
     */
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        $flashPeriodLive = FlashSalePeriodSettings::isLive();

        $products = Product::visible()
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->withSum('orderItems as sold_count', 'quantity')
            ->when($q !== '', fn ($query) => CatalogSearch::apply($query, $q))
            ->when($q !== '' && $flashPeriodLive, function ($query) {
                $query->orderByRaw(
                    "CASE WHEN EXISTS (
                        SELECT 1 FROM product_attributes pa
                        WHERE pa.product_id = products.id
                          AND LOWER(TRIM(pa.attribute_name)) IN ('promo_flash_sale', 'flash_sale')
                          AND LOWER(TRIM(pa.attribute_value)) IN ('true', '1', 'yes', 'on')
                    ) THEN 0 ELSE 1 END"
                );
            })
            ->orderByDesc('id')
            ->paginate(24)
            ->withQueryString();

        return response()->json([
            'query' => $q,
            'products' => $products->getCollection()->map(
                fn ($product) => $product->toApiArray()
            )->all(),
            'pagination' => [
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
            ],
        ]);
    }
}
