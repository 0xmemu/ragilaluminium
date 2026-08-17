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
            ->withPopularityScore()
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

        // Normalisasi deterministik (typo + sinonim). Query ASLI (`query`/`original`)
        // selalu dipertahankan untuk debrief/telemetri; `normalized` hanya dipakai
        // untuk konteks disambiguasi — tidak pernah mengganti input diam-diam.
        $meta = CatalogSearch::normalizeQuery($q);

        // Dimensi: ukuran eksak (Tinggi × Panjang) atau range (orientasi tetap).
        $dimension = null;
        if ($q !== '') {
            $exact = CatalogSearch::exactDimension($q);
            if ($exact !== null) {
                $dimension = [
                    'kind' => 'exact',
                    'height' => $exact['height'],
                    'width' => $exact['width'],
                ];
            } else {
                $range = CatalogSearch::dimensionRange($q);
                if ($range !== null) {
                    $dimension = [
                        'kind' => 'range',
                        'height_min' => $range['hMin'],
                        'height_max' => $range['hMax'],
                        'width_min' => $range['wMin'],
                        'width_max' => $range['wMax'],
                    ];
                }
            }
        }

        // Saat tidak ada hasil: tawarkan ukuran terdekat (untuk ukuran eksak) atau
        // saran kata kunci katalog yang BENAR-BENAR ada (untuk query tidak berbuah).
        $nearestSizes = [];
        $suggestions = [];
        if ($products->total() === 0 && $q !== '') {
            if (isset($dimension['kind']) && $dimension['kind'] === 'exact') {
                $nearestSizes = CatalogSearch::nearestSizeVariants($dimension['height'], $dimension['width']);
            } elseif ($meta['normalized'] !== '') {
                $suggestions = CatalogSearch::catalogKeywordSuggestions(10);
            }
        }

        return response()->json([
            'query' => $q,
            'search' => [
                'original' => $meta['original'],
                'normalized' => $meta['normalized'],
                'changed' => $meta['changed'],
                'replacements' => $meta['replacements'],
            ],
            'dimension' => $dimension,
            'products' => $products->getCollection()->map(
                fn ($product) => $product->toApiArray()
            )->all(),
            'pagination' => [
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
            ],
            'nearest_sizes' => $nearestSizes,
            'suggestions' => $suggestions,
        ]);
    }
}
