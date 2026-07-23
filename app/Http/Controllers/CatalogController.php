<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Support\CatalogLabels;
use App\Support\CatalogTaxonomy;
use App\Support\FlashSalePeriodSettings;
use App\Support\InertiaCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function index(Request $request): JsonResponse|Response
    {
        // API tetap daftar produk SKU.
        if ($request->is('api/*') || $request->wantsJson()) {
            return $this->category(null, $request);
        }

        // /products?sort=popular|…|q|model → daftar produk (card-produk).
        // /products (hub) → Semua Model Produk (card-model-produk).
        $listing = $request->filled('sort')
            || $request->filled('q')
            || $request->filled('model')
            || $request->filled('price_min')
            || $request->filled('price_max');

        if ($listing) {
            return $this->category(null, $request);
        }

        return $this->modelsHub($request);
    }

    /** Halaman Promo — listing SKU dengan atribut promo eksplisit. */
    public function promo(Request $request): JsonResponse|Response
    {
        return $this->category(null, $request, mode: 'promo');
    }

    /** Halaman Flash Sale — hanya produk dengan atribut flash sale aktif. */
    public function flashSale(Request $request): JsonResponse|Response
    {
        return $this->category(null, $request, mode: 'flash');
    }

    public function windows(Request $request): JsonResponse|Response
    {
        return $this->category('WINDOW', $request);
    }

    public function doors(Request $request): JsonResponse|Response
    {
        return $this->category('DOOR', $request);
    }

    public function bouven(Request $request): JsonResponse|Response
    {
        return $this->category('BOUVEN', $request);
    }

    protected function category(?string $category, Request $request, string $mode = 'catalog'): JsonResponse|Response
    {
        $sort = $request->input('sort');
        $model = CatalogLabels::normalizeModel($request->input('model'));
        $design = CatalogLabels::normalizeDesign($request->input('design'));
        $promoOnly = $mode === 'promo';
        $flashOnly = $mode === 'flash';
        $flashPeriodLive = FlashSalePeriodSettings::isLive();

        $promoAttributes = [
            'promo_compare_price',
            'compare_price',
            'harga_asli',
            'harga_sebelum_diskon',
            'promo_flash_sale',
            'flash_sale',
        ];

        $products = Product::visible()
            ->when($category, fn ($q) => $q->where('product_category', $category))
            ->when($promoOnly, fn ($q) => $q->whereHas(
                'attributes',
                fn ($qa) => $qa->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(TRIM(attribute_name))'), $promoAttributes)
            ))
            ->when($flashOnly, function ($q) use ($flashPeriodLive) {
                if (! $flashPeriodLive) {
                    $q->whereRaw('0 = 1');

                    return;
                }
                $this->scopeFlashSaleActive($q);
            })
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->withMin('activeVariants as min_price_sort', 'price')
            ->withSum('orderItems as sold_count', 'quantity')
            ->when($model, fn ($q) => $q->where('product_model', $model))
            ->when($design, fn ($q) => $q->where('design_variant', $design))
            ->when(
                $request->filled('q'),
                function ($q) use ($request) {
                    $term = trim((string) $request->input('q'));
                    $q->where(function ($inner) use ($term) {
                        $inner->where('name', 'like', "%{$term}%")
                            ->orWhere('parent_sku', 'like', "%{$term}%")
                            ->orWhere('short_name', 'like', "%{$term}%")
                            ->orWhereHas('attributes', fn ($qa) => $qa->where('attribute_value', 'like', "%{$term}%"));
                    });
                }
            )
            ->when(
                $request->filled('price_min'),
                fn ($q) => $q->whereHas('activeVariants', fn ($q2) => $q2->where('price', '>=', $request->price_min))
            )
            ->when(
                $request->filled('price_max'),
                fn ($q) => $q->whereHas('activeVariants', fn ($q2) => $q2->where('price', '<=', $request->price_max))
            )
            ->when(
                $request->filled('q') && $flashPeriodLive && ! $flashOnly,
                function ($q) {
                    $q->orderByRaw(
                        "CASE WHEN EXISTS (
                            SELECT 1 FROM product_attributes pa
                            WHERE pa.product_id = products.id
                              AND LOWER(TRIM(pa.attribute_name)) IN ('promo_flash_sale', 'flash_sale')
                              AND LOWER(TRIM(pa.attribute_value)) IN ('true', '1', 'yes', 'on')
                        ) THEN 0 ELSE 1 END"
                    );
                }
            )
            ->when($sort === 'price_asc', fn ($q) => $q->orderBy('min_price_sort'))
            ->when($sort === 'price_desc', fn ($q) => $q->orderByDesc('min_price_sort'))
            ->when($sort === 'newest' || $sort === 'baru', fn ($q) => $q->latest('created_at')->orderByDesc('id'))
            ->when($sort === 'popular', fn ($q) => $q->orderByDesc('sold_count')->orderByDesc('id'))
            ->when(
                $sort === 'name_asc' || $sort === 'abjad',
                fn ($q) => $q->orderByRaw('COALESCE(NULLIF(name, ""), short_name) asc')->orderBy('id')
            )
            ->when(! $sort, fn ($q) => $q->latest('created_at')->orderByDesc('id'))
            ->paginate(24)
            ->withQueryString();

        $flashSaleSpotlight = [];
        if ($promoOnly && $flashPeriodLive && ! ($request->is('api/*') || $request->wantsJson())) {
            $flashQuery = Product::visible();
            $this->scopeFlashSaleActive($flashQuery);
            $flashSaleSpotlight = InertiaCatalog::productCards(
                $flashQuery
                    ->with(['mainImage', 'activeVariants', 'attributes'])
                    ->withSum('orderItems as sold_count', 'quantity')
                    ->latest('updated_at')
                    ->orderByDesc('id')
                    ->limit(8)
                    ->get()
            );
        }

        $youMightLike = [];
        if (
            $request->filled('q')
            && $flashPeriodLive
            && ! $flashOnly
            && ! ($request->is('api/*') || $request->wantsJson())
        ) {
            $youMightLike = $this->searchYouMightLikeFlashCards(
                term: trim((string) $request->input('q')),
                category: $category,
            );
        }

        if ($request->is('api/*') || $request->wantsJson()) {
            return response()->json([
                'category' => $category ?? 'ALL',
                'category_name' => CatalogLabels::category($category),
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

        $basePath = match (true) {
            $flashOnly => '/flash-sale',
            $promoOnly => '/promo',
            $category === 'WINDOW' => '/windows',
            $category === 'DOOR' => '/doors',
            $category === 'BOUVEN' => '/bouven',
            default => '/products',
        };

        $categoryName = match (true) {
            $flashOnly => 'Flash Sale',
            $promoOnly => 'Promo',
            $sort === 'popular' && ! $category => 'Paling Banyak Dipesan',
            ! $category => 'Semua Produk',
            default => CatalogLabels::category($category) ?: 'Semua Produk',
        };

        $productCards = InertiaCatalog::productCards($products->getCollection());
        if ($youMightLike !== [] && (int) $products->currentPage() === 1) {
            $likeIds = collect($youMightLike)->pluck('id')->all();
            $productCards = array_values(array_filter(
                $productCards,
                fn (array $card) => ! in_array($card['id'], $likeIds, true)
            ));
        }

        return Inertia::render('Public/Catalog', [
            'category' => $category ?? 'ALL',
            'categoryName' => $categoryName,
            'listingMode' => $flashOnly ? 'flash' : ($promoOnly ? 'promo' : 'catalog'),
            'isAllProductsListing' => $category === null && ! $promoOnly && ! $flashOnly,
            'products' => $productCards,
            'youMightLike' => $youMightLike,
            'flashSaleSpotlight' => $flashSaleSpotlight,
            'flashSalePeriod' => FlashSalePeriodSettings::publicState(),
            'pagination' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'links' => $products->linkCollection()->toArray(),
            ],
            'filterModels' => collect(CatalogTaxonomy::models($category))
                ->map(fn ($m) => ['value' => $m, 'label' => CatalogLabels::model($m) ?: $m])
                ->values()
                ->all(),
            'filterDesigns' => CatalogTaxonomy::availableDesignFilters(),
            'activeModel' => $model,
            'activeDesign' => $design,
            'activeSort' => $sort,
            'searchQuery' => trim((string) $request->input('q', '')),
            'priceMin' => $request->filled('price_min') ? (int) $request->input('price_min') : null,
            'priceMax' => $request->filled('price_max') ? (int) $request->input('price_max') : null,
            'basePath' => $basePath,
        ]);
    }

    /**
     * Flash Sale terkait pencarian (match teks atau model yang sama dengan hasil cari).
     *
     * @return list<array<string, mixed>>
     */
    protected function searchYouMightLikeFlashCards(string $term, ?string $category): array
    {
        if ($term === '') {
            return [];
        }

        $matchedModels = Product::visible()
            ->when($category, fn ($q) => $q->where('product_category', $category))
            ->where(function ($inner) use ($term) {
                $inner->where('name', 'like', "%{$term}%")
                    ->orWhere('parent_sku', 'like', "%{$term}%")
                    ->orWhere('short_name', 'like', "%{$term}%")
                    ->orWhereHas('attributes', fn ($qa) => $qa->where('attribute_value', 'like', "%{$term}%"));
            })
            ->limit(48)
            ->pluck('product_model')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $flashQuery = Product::visible()->when($category, fn ($q) => $q->where('product_category', $category));
        $this->scopeFlashSaleActive($flashQuery);

        $flashQuery->where(function ($inner) use ($term, $matchedModels) {
            $inner->where('name', 'like', "%{$term}%")
                ->orWhere('parent_sku', 'like', "%{$term}%")
                ->orWhere('short_name', 'like', "%{$term}%")
                ->orWhereHas('attributes', fn ($qa) => $qa->where('attribute_value', 'like', "%{$term}%"));
            if ($matchedModels !== []) {
                $inner->orWhereIn('product_model', $matchedModels);
            }
        });

        return InertiaCatalog::productCards(
            $flashQuery
                ->with(['mainImage', 'activeVariants', 'attributes'])
                ->withSum('orderItems as sold_count', 'quantity')
                ->latest('updated_at')
                ->orderByDesc('id')
                ->limit(8)
                ->get()
        );
    }

    /** @param  \Illuminate\Database\Eloquent\Builder<\App\Models\Product>  $query */
    protected function scopeFlashSaleActive($query)
    {
        $flashAttributes = ['promo_flash_sale', 'flash_sale'];
        $trueValues = ['true', '1', 'yes', 'on'];

        return $query->whereHas('attributes', function ($attr) use ($flashAttributes, $trueValues) {
            $attr->whereIn('attribute_name', $flashAttributes)
                ->where(function ($inner) use ($trueValues) {
                    foreach ($trueValues as $value) {
                        $inner->orWhereRaw('LOWER(TRIM(attribute_value)) = ?', [$value]);
                    }
                });
        });
    }

    /** Halaman Semua Model Produk — kartu model (`card-model-produk`), bukan SKU. */
    protected function modelsHub(Request $request): Response
    {
        $design = CatalogLabels::normalizeDesign($request->input('design'));

        return Inertia::render('Public/ModelProduk', [
            'models' => app(\App\Services\ModelProductService::class)->storefrontCards(0, $design),
            'filterDesigns' => CatalogTaxonomy::availableDesignFilters(),
            'activeDesign' => $design,
        ]);
    }
}
