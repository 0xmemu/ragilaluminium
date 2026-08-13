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
        $flashOnly = $mode === 'flash' || $request->boolean('flash');
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
            ->when($promoOnly, function ($q) use ($promoAttributes) {
                $ids = app(\App\Services\CampaignService::class)->promoProductIds();
                if ($ids !== []) {
                    $q->whereIn('id', $ids);

                    return;
                }
                $q->whereHas('attributes', fn ($qa) => $qa->whereIn(DB::raw('LOWER(TRIM(attribute_name))'), $promoAttributes));
            })
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
            ->withSum('activeVariants as stock_sort', 'stock')
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
                // Populer: penjualan dulu, lalu stok terbanyak sebagai tie-breaker
                // (belum ada pembelian → produk stok tertinggi tampil di depan).
                fn ($q) => $q->orderByDesc('sold_count')->orderByDesc('stock_sort')->orderByDesc('id')
            )
             ->paginate(14)
            ->withQueryString();

        $flashSaleSpotlight = [];
        if (
            ! $flashOnly
            && $products->currentPage() <= 1
            && $flashPeriodLive
            && ! ($request->is('api/*') || $request->wantsJson())
        ) {
            // Spotlight Flash Sale di atas daftar produk (halaman 1 saja).
            // Tampil di halaman promo dan halaman "Paling Banyak Dipesan" (popular/all).
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

        // Pencarian tanpa hasil: tawarkan ukuran terdekat + kategori terkait
        // + ajakan konsultasi WhatsApp, bukan sekadar "tidak ada hasil".
        $searchFallback = null;
        if (
            $request->filled('q')
            && $products->isEmpty()
            && ! ($request->is('api/*') || $request->wantsJson())
        ) {
            $searchFallback = $this->searchFallbackFor(
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
            $request->routeIs('catalog.flash-sale') => '/flash-sale',
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
        // Carousel "Paling Banyak Dipesan" ditampilkan di semua halaman listing
        // katalog (semua produk, kategori, model, desain), bukan promo/flash/API.
        $popularProducts = [];
        if (
            ! $promoOnly
            && ! $flashOnly
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
            'searchFallback' => $searchFallback,
            'priceMin' => $request->filled('price_min') ? (int) $request->input('price_min') : null,
            'priceMax' => $request->filled('price_max') ? (int) $request->input('price_max') : null,
            'basePath' => $basePath,
            'canonicalUrl' => url($isAllProductsListing ? '/products/all' : $basePath),
            'robotsDirective' => ! $request->routeIs('catalog.category', 'catalog.design') && ($request->hasAny(['q', 'model', 'design', 'price_min', 'price_max']) || $request->filled('sort')) ? 'noindex,follow' : 'index,follow',
        ]);
    }

    /**
     * Fallback saat pencarian tanpa hasil: ukuran terdekat (dari dimensi varian)
     * dan model/kategori terkait dari token pencarian.
     *
     * @return array{nearby_sizes: list<array<string, mixed>>, related_models: list<array{label: string, href: string}>}|null
     */
    protected function searchFallbackFor(string $term, ?string $category): ?array
    {
        $nearbySizes = [];
        $relatedModels = [];

        if (preg_match('/(\d+)\s*[x×]\s*(\d+)/iu', $term, $matches)) {
            $dims = array_values(array_unique([(float) $matches[1], (float) $matches[2]]));

            $nearby = Product::visible()
                ->when($category, fn ($q) => $q->where('product_category', $category))
                ->whereHas('activeVariants', function ($q) use ($dims) {
                    $q->where(function ($inner) use ($dims) {
                        foreach ($dims as $dimension) {
                            $inner->orWhereBetween('height_cm', [$dimension - 15, $dimension + 15])
                                ->orWhereBetween('width_cm', [$dimension - 15, $dimension + 15]);
                        }
                    });
                })
                ->with(['mainImage', 'activeVariants', 'attributes'])
                ->withSum('validOrderItems as sold_count', 'quantity')
                ->latest('id')
                ->limit(8)
                ->get();

            $nearbySizes = InertiaCatalog::productCards($nearby);
        }

        $tokens = preg_split('/\s+/u', mb_strtolower($term), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $haystacks = array_values(array_unique(array_merge([mb_strtolower($term)], $tokens)));
        $categorySlug = match (strtoupper((string) $category)) {
            'DOOR' => 'doors',
            'BOUVEN' => 'bouven',
            default => 'window',
        };

        foreach (CatalogLabels::MODEL_ORDER as $code) {
            $label = mb_strtolower(CatalogLabels::model($code));
            $slug = mb_strtolower(str_replace('_', ' ', $code));
            foreach ($haystacks as $piece) {
                if ($piece === '') {
                    continue;
                }
                if ($piece === $label || $piece === $slug || str_contains($slug, $piece) || str_contains($piece, $slug)) {
                    $relatedModels[] = [
                        'label' => CatalogLabels::model($code) ?: $code,
                        'href' => route('catalog.model', [
                            'category' => $categorySlug,
                            'model' => strtolower(str_replace('_', '-', $code)),
                        ], absolute: false),
                    ];
                    break;
                }
            }
        }

        $relatedModels = array_values(array_unique(array_map(
            fn (array $row) => $row['label'].'|'.$row['href'],
            $relatedModels,
        )));
        $relatedModels = array_values(array_map(
            fn (string $key) => ['label' => explode('|', $key)[0], 'href' => explode('|', $key)[1]],
            $relatedModels,
        ));

        // Tetap kirim struktur walau keduanya kosong: halaman membutuhkannya
        // untuk menampilkan kartu "Tidak menemukan ukuran yang sesuai?"
        // + tombol Konsultasi via WhatsApp.
        return [
            'nearby_sizes' => $nearbySizes,
            'related_models' => $relatedModels,
        ];
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
        $flashIds = app(\App\Services\CampaignService::class)->flashProductIds();
        if ($flashIds !== []) {
            return $query->whereIn('id', $flashIds);
        }

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
        $category = CatalogLabels::normalizeCategory($request->input('category'));

        return Inertia::render('Public/ModelProduk', [
            'models' => app(ModelProductService::class)->storefrontCards(0, $design, $category),
            'filterDesigns' => CatalogTaxonomy::availableDesignFilters(),
            'filterModels' => collect(CatalogTaxonomy::models($category))
                ->map(fn ($model) => ['value' => $model, 'label' => CatalogLabels::model($model) ?: $model])
                ->values()
                ->all(),
            'activeDesign' => $design,
            'activeCategory' => $category,
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

        $designRails = $this->designRailsForModel($products, $categoryCode, $modelCode);

        return Inertia::render('Public/ModelDetail', [
            'model' => $card,
            'products' => InertiaCatalog::productCards($products),
            'designRails' => $designRails,
            'hubHref' => route('catalog.index', absolute: false),
        ]);
    }

    /**
     * Landing segment pill — SATU template dinamis. Segment diselesaikan dari
     * ?segment={slug} (contoh: boven-jungkit, jendela-sliding); default segment
     * pertama. Data diambil dari sumber yang sudah ada (produk, kategori, model,
     * hasil pemasangan) — tanpa duplikasi data produk. Pindah pill = partial
     * reload di halaman yang sama, bukan pindah ke halaman detail model.
     */
    public function segmentLanding(Request $request): Response
    {
        try {
            $categoryMenu = app(ModelProductService::class)->storefrontCategoryMenu();
        } catch (\Throwable) {
            $categoryMenu = [];
        }

        $segmentSlug = strtolower(trim((string) $request->query('segment')));
        $selected = null;
        foreach ($categoryMenu as $item) {
            $categorySlug = match (strtoupper((string) ($item['category'] ?? ''))) {
                'DOOR' => 'doors',
                'BOUVEN' => 'bouven',
                default => 'windows',
            };
            $modelSlug = strtolower(str_replace('_', '-', (string) ($item['model'] ?? '')));
            if (($categorySlug.'-'.$modelSlug) === $segmentSlug) {
                $selected = $item;
                break;
            }
        }

        // Default: segment pertama dari menu kategori.
        if ($selected === null) {
            $selected = $categoryMenu[0] ?? null;
        }
        if ($selected === null) {
            abort(404);
        }

        $categoryCode = strtoupper((string) ($selected['category'] ?? ''));
        $modelCode = strtoupper((string) ($selected['model'] ?? ''));

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
            ->orderByDesc('sold_count')
            ->orderByDesc('id')
            ->limit(48)
            ->get();

        $productCards = InertiaCatalog::productCards($products);

        // Promosi khusus segment — kartu berdiskon aktif.
        $promos = collect($productCards)
            ->filter(fn (array $c) => (int) ($c['discount_percent'] ?? 0) > 0)
            ->sortByDesc(fn (array $c) => (int) ($c['discount_percent'] ?? 0))
            ->values()
            ->take(10)
            ->all();

        // Submodel/desain segment (Ornamen, Polos, Kombinasi, ...).
        $designs = array_map(
            fn (array $rail) => collect($rail)->except('products')->all(),
            $this->designRailsForModel($products, $categoryCode, $modelCode),
        );

        // Paling banyak dipesan — produk segment terlaris.
        $bestSellers = array_slice($productCards, 0, 10);

        // Seluruh produk segment (grid).
        $products = array_slice($productCards, 0, 24);

        // Galeri foto/video hasil pemasangan segment.
        $documentation = collect(InstallationGallery::productCardsForModel($categoryCode, $modelCode, 24))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'image_url' => $item['image_url'] ?? null,
                'label' => $item['label'],
                'product_count' => (int) ($item['product_count'] ?? 0),
                'photo_count' => (int) ($item['photo_count'] ?? 0),
                'video_count' => (int) ($item['video_count'] ?? 0),
                'category' => $item['category'] ?? null,
                'model' => $item['model'] ?? null,
                'href' => $item['href'] ?? null,
                'product_sku' => $item['product_sku'] ?? null,
                'product_href' => $item['product_href'] ?? null,
            ])
            ->values()
            ->all();

        // Model terkait — sesama kategori diutamakan, lalu model lain.
        $relatedModels = collect(app(ModelProductService::class)->storefrontCards())
            ->reject(function (array $item) use ($categoryCode, $modelCode) {
                return strtoupper((string) ($item['category'] ?? '')) === $categoryCode
                    && strtoupper((string) ($item['model'] ?? '')) === $modelCode;
            })
            ->sortByDesc(fn (array $item) => (int) (strtoupper((string) ($item['category'] ?? '')) === $categoryCode))
            ->values()
            ->take(6)
            ->all();

        $categorySlug = match ($categoryCode) {
            'DOOR' => 'doors',
            'BOUVEN' => 'bouven',
            default => 'windows',
        };

        // "Lihat semua" -> listing katalog kategori yang difilter model.
        $allHref = route('catalog.category', ['category' => $categorySlug], absolute: false)
            .'?model='.urlencode($modelCode);

        return Inertia::render('Public/SegmentLanding', [
            'segment' => $segmentSlug,
            'model' => $card,
            'promos' => $promos,
            'designs' => $designs,
            'bestSellers' => $bestSellers,
            'products' => $products,
            'documentation' => $documentation,
            'relatedModels' => $relatedModels,
            'categoryMenu' => $categoryMenu,
            'allHref' => $allHref,
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
                    $code !== 'POLOS' ? CatalogLabels::design($code) : null,
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
