<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\ModelProductService;
use App\Support\CatalogLabels;
use App\Support\CatalogSearch;
use App\Support\CatalogTaxonomy;
use App\Support\FlashSalePeriodSettings;
use App\Support\InertiaCatalog;
use App\Support\InstallationGallery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function index(Request $request): JsonResponse|\Illuminate\Http\RedirectResponse|Response
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
            return redirect()->route('catalog.all', $request->query());
        }

        return $this->modelsHub($request);
    }

    /** Listing seluruh SKU pada URL yang tidak ambigu. */
    public function all(Request $request): JsonResponse|Response
    {
        return $this->category(null, $request);
    }

    public function categoryShow(string $category, Request $request): JsonResponse|Response
    {
        $categoryCode = InstallationGallery::categoryFromSlug($category);
        if ($categoryCode === null || $categoryCode === 'LAINNYA') {
            abort(404);
        }

        return $this->category($categoryCode, $request);
    }

    public function designShow(string $category, string $model, string $design, Request $request): JsonResponse|Response
    {
        $categoryCode = InstallationGallery::categoryFromSlug($category);
        $modelCode = InstallationGallery::modelFromSlug($model);
        $designCode = CatalogLabels::normalizeDesign($design);
        if ($categoryCode === null || $categoryCode === 'LAINNYA' || $modelCode === '' || $designCode === null) {
            abort(404);
        }
        $request->merge(['model' => $modelCode, 'design' => $designCode]);

        return $this->category($categoryCode, $request);
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

    public function windows(Request $request)
    {
        return $this->redirectLegacyCategory('windows', $request);
    }

    public function doors(Request $request)
    {
        return $this->redirectLegacyCategory('doors', $request);
    }

    public function bouven(Request $request)
    {
        return $this->redirectLegacyCategory('bouven', $request);
    }

    protected function redirectLegacyCategory(string $category, Request $request)
    {
        $model = CatalogLabels::normalizeModel($request->query('model'));
        $design = CatalogLabels::normalizeDesign($request->query('design'));
        $parameters = ['category' => $category];
        $route = 'catalog.category';

        if (filled($model)) {
            $parameters['model'] = str_replace('_', '-', strtolower($model));
            $route = 'catalog.model';
        }

        if (filled($model) && filled($design)) {
            $parameters['design'] = str_replace('_', '-', strtolower($design));
            $route = 'catalog.design';
        }

        $query = $request->except(['model', 'design']);

        return redirect()->to(route($route, $parameters).($query === [] ? '' : '?'.http_build_query($query)), 301);
    }

    protected function category(?string $category, Request $request, string $mode = 'catalog'): JsonResponse|Response
    {
        $sort = (string) $request->input('sort', 'popular');
        if (! in_array($sort, ['popular', 'terlaris', 'bestseller', 'newest', 'baru', 'size_asc', 'size_desc', 'price_asc', 'price_desc'], true)) {
            $sort = 'popular';
        }
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
                fn ($qa) => $qa->whereIn(DB::raw('LOWER(TRIM(attribute_name))'), $promoAttributes)
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
            ->withMin('activeVariants as min_height_sort', 'height_cm')
            ->withMin('activeVariants as min_width_sort', 'width_cm')
            ->withSum('validOrderItems as sold_count', 'quantity')
            ->when($model, fn ($q) => $q->where('product_model', $model))
            ->when($design, fn ($q) => $q->where('design_variant', $design))
            ->when(
                $request->filled('q'),
                function ($q) use ($request) {
                    CatalogSearch::apply($q, (string) $request->input('q'));
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
            ->when($sort === 'size_asc', fn ($q) => $q->orderByRaw('min_height_sort is null')->orderBy('min_height_sort')->orderByRaw('min_width_sort is null')->orderBy('min_width_sort')->orderBy('parent_sku'))
            ->when($sort === 'size_desc', fn ($q) => $q->orderByRaw('min_height_sort is null')->orderByDesc('min_height_sort')->orderByRaw('min_width_sort is null')->orderByDesc('min_width_sort')->orderByDesc('parent_sku'))
            ->when($sort === 'price_asc', fn ($q) => $q->orderByRaw('min_price_sort is null')->orderBy('min_price_sort')->orderBy('id'))
            ->when($sort === 'price_desc', fn ($q) => $q->orderByRaw('min_price_sort is null')->orderByDesc('min_price_sort')->orderByDesc('id'))
            ->when($sort === 'newest' || $sort === 'baru', fn ($q) => $q->latest('created_at')->orderByDesc('id'))
            ->when(
                in_array($sort, ['popular', 'terlaris', 'bestseller'], true),
                fn ($q) => $q->orderByDesc('sold_count')->orderByDesc('id')
            )
             ->paginate(24)
            ->withQueryString();

        $flashSaleSpotlight = [];
        if ($promoOnly && $flashPeriodLive && ! ($request->is('api/*') || $request->wantsJson())) {
            $flashQuery = Product::visible();
            $this->scopeFlashSaleActive($flashQuery);
            $flashSaleSpotlight = InertiaCatalog::productCards(
                $flashQuery
                    ->with(['mainImage', 'activeVariants', 'attributes'])
                    ->withSum('validOrderItems as sold_count', 'quantity')
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

        $categoryName = $this->listingTitle(
            category: $category,
            model: $model,
            design: $design,
            sort: $request->filled('sort') ? $sort : null,
            flashOnly: $flashOnly,
            promoOnly: $promoOnly,
        );

        if ($request->is('api/*') || $request->wantsJson()) {
            return response()->json([
                'category' => $category ?? 'ALL',
                'category_name' => $categoryName,
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
            $request->routeIs('catalog.category', 'catalog.design') => '/'.$request->path(),
            $category === 'WINDOW' => '/products/windows',
            $category === 'DOOR' => '/products/doors',
            $category === 'BOUVEN' => '/products/bouven',
            default => '/products/all',
        };

        $productCards = InertiaCatalog::productCards($products->getCollection());
        if ($youMightLike !== [] && (int) $products->currentPage() === 1) {
            $likeIds = collect($youMightLike)->pluck('id')->all();
            $productCards = array_values(array_filter(
                $productCards,
                fn (array $card) => ! in_array($card['id'], $likeIds, true)
            ));
        }

        $isAllProductsListing = $category === null && ! $promoOnly && ! $flashOnly;
        $popularProducts = [];
        if (
            $isAllProductsListing
            && ! ($request->is('api/*') || $request->wantsJson())
        ) {
            $popularProducts = InertiaCatalog::popularProductCards(10);
        }

        return Inertia::render('Public/Catalog', [
            'category' => $category ?? 'ALL',
            'categoryName' => $categoryName,
            'listingMode' => $flashOnly ? 'flash' : ($promoOnly ? 'promo' : 'catalog'),
            'isAllProductsListing' => $isAllProductsListing,
            'products' => $productCards,
            'popularProducts' => $popularProducts,
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
            'canonicalUrl' => url($isAllProductsListing ? '/products/all' : $basePath),
            'robotsDirective' => ! $request->routeIs('catalog.category', 'catalog.design') && ($request->hasAny(['q', 'model', 'design', 'price_min', 'price_max']) || $request->filled('sort')) ? 'noindex,follow' : 'index,follow',
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
            ->when($category, fn ($q) => $q->where('product_category', $category));
        CatalogSearch::apply($matchedModels, $term);
        $matchedModels = $matchedModels
            ->limit(48)
            ->pluck('product_model')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $flashQuery = Product::visible()->when($category, fn ($q) => $q->where('product_category', $category));
        $this->scopeFlashSaleActive($flashQuery);

        $flashQuery->where(function ($inner) use ($term, $matchedModels) {
            CatalogSearch::apply($inner, $term);
            if ($matchedModels !== []) {
                $inner->orWhereIn('product_model', $matchedModels);
            }
        });

        return InertiaCatalog::productCards(
            $flashQuery
                ->with(['mainImage', 'activeVariants', 'attributes'])
                ->withSum('validOrderItems as sold_count', 'quantity')
                ->latest('updated_at')
                ->orderByDesc('id')
                ->limit(8)
                ->get()
        );
    }

    /** @param  Builder<Product>  $query */
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
            'models' => app(ModelProductService::class)->storefrontCards(0, $design),
            'popularProducts' => InertiaCatalog::popularProductCards(10),
            'filterDesigns' => CatalogTaxonomy::availableDesignFilters(),
            'activeDesign' => $design,
        ]);
    }

    /**
     * Halaman detail satu model (deskripsi + highlight) + daftar produk nyata model itu.
     */
    public function modelShow(string $category, string $model): Response
    {
        $categoryCode = InstallationGallery::categoryFromSlug($category);
        $modelCode = InstallationGallery::modelFromSlug($model);

        if ($categoryCode === null || $categoryCode === 'LAINNYA' || $modelCode === '') {
            abort(404);
        }

        $card = collect(app(ModelProductService::class)->storefrontCards())
            ->first(function (array $item) use ($categoryCode, $modelCode) {
                return strtoupper((string) ($item['category'] ?? '')) === $categoryCode
                    && strtoupper((string) ($item['model'] ?? '')) === $modelCode;
            });

        if (! is_array($card)) {
            abort(404);
        }

        $products = Product::visible()
            ->where('product_category', $categoryCode)
            ->where('product_model', $modelCode)
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->withSum('validOrderItems as sold_count', 'quantity')
            ->latest('id')
            ->limit(48)
            ->get();

        $listingHref = (string) ($card['href'] ?? route('catalog.index', absolute: false));
        $designRails = $this->designRailsForModel($products, $categoryCode, $modelCode);

        return Inertia::render('Public/ModelDetail', [
            'model' => $card,
            'products' => InertiaCatalog::productCards($products),
            'designRails' => $designRails,
            'hubHref' => route('catalog.index', absolute: false),
            'listingHref' => $listingHref,
        ]);
    }

    /**
     * Rail per desain: hanya produk category+model halaman ini; kartu = ukuran terurut.
     * Hanya desain yang punya produk yang ditampilkan (tanpa carousel kosong).
     *
     * @param  \Illuminate\Support\Collection<int, Product>  $products
     * @return list<array<string, mixed>>
     */
    protected function designRailsForModel($products, string $categoryCode, string $modelCode): array
    {
        $grouped = $products
            ->filter(
                fn (Product $product) => strtoupper((string) $product->product_category) === strtoupper($categoryCode)
                    && strtoupper((string) $product->product_model) === strtoupper($modelCode)
            )
            ->map(function (Product $product) {
                $code = CatalogLabels::normalizeDesign($product->design_variant);
                // Tanpa design_variant → anggap Polos (desain default katalog).
                if ($code === null || $code === '') {
                    $code = 'POLOS';
                }

                return ['code' => $code, 'product' => $product];
            })
            ->groupBy('code');

        if ($grouped->isEmpty()) {
            return [];
        }

        $categorySlug = match ($categoryCode) {
            'DOOR' => 'doors',
            'BOUVEN' => 'bouven',
            default => 'windows',
        };

        $ordered = [];
        foreach (CatalogLabels::DESIGN_ORDER as $code) {
            if ($grouped->has($code)) {
                $ordered[] = $code;
            }
        }
        foreach ($grouped->keys() as $code) {
            if (! in_array($code, $ordered, true)) {
                $ordered[] = $code;
            }
        }

        $rails = [];
        foreach ($ordered as $code) {
            $railProducts = $grouped->get($code)->map(fn (array $row) => $row['product'])->values();
            if ($railProducts->isEmpty()) {
                continue;
            }

            $uniqueSizes = [];
            foreach ($railProducts as $product) {
                if (! $product->relationLoaded('activeVariants')) {
                    continue;
                }
                foreach ($product->activeVariants as $variant) {
                    $height = (float) ($variant->height_cm ?? 0);
                    $width = (float) ($variant->width_cm ?? 0);
                    if ($height <= 0 || $width <= 0) {
                        continue;
                    }
                    $uniqueSizes[round($height, 2).'x'.round($width, 2)] = true;
                }
            }

            $railCards = InertiaCatalog::sizeCardsForRail($railProducts, 12);
            if ($railCards === []) {
                $railCards = InertiaCatalog::productCards($railProducts->sortBy('name')->values());
            }
            if ($railCards === []) {
                continue;
            }

            /** @var Product $sample */
            $sample = $railProducts->sortByDesc(
                fn (Product $p) => $p->relationLoaded('activeVariants') ? $p->activeVariants->count() : 0
            )->first();

            $rails[] = [
                'value' => $code,
                'label' => CatalogLabels::design($code) ?: $code,
                'title' => trim(implode(' ', array_filter([
                    CatalogLabels::category($categoryCode),
                    CatalogLabels::model($modelCode),
                    CatalogLabels::design($code),
                ]))),
                'image' => InertiaCatalog::cardImage($sample),
                'count' => $railProducts->count(),
                'size_count' => count($uniqueSizes) > 0 ? count($uniqueSizes) : $railProducts->count(),
                'href' => route('catalog.design', [
                    'category' => $categorySlug,
                    'model' => strtolower(str_replace('_', '-', $modelCode)),
                    'design' => strtolower(str_replace('_', '-', $code)),
                ], absolute: false),
                'products' => $railCards,
            ];
        }

        return $rails;
    }

    /**
     * Judul listing: ikut filter model/desain bila aktif (mis. "Jendela Sliding").
     */
    protected function listingTitle(
        ?string $category,
        ?string $model,
        ?string $design,
        ?string $sort,
        bool $flashOnly,
        bool $promoOnly,
    ): string {
        if ($flashOnly) {
            return 'Flash Sale';
        }
        if ($promoOnly) {
            return 'Promo';
        }
        if ($sort === 'popular' && ! $category && ! $model && ! $design) {
            return 'Paling Banyak Dipesan';
        }

        if ($model || $design) {
            $line = CatalogLabels::productLine($category, $model, $design);
            if ($line !== '') {
                return $line;
            }
        }

        if (! $category) {
            return 'Semua Produk';
        }

        return CatalogLabels::category($category) ?: 'Semua Produk';
    }
}
