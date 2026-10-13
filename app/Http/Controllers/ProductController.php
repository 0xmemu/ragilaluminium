<?php

namespace App\Http\Controllers;

use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Services\ProductEngagementService;
use App\Services\ProductPopularityService;
use App\Support\CatalogLabels;
use App\Support\CategoryUrl;
use App\Support\InertiaCatalog;
use App\Support\InstallationGallery;
use App\Support\ProductPromotionMetadata;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function show(Request $request, string $parent_sku): JsonResponse|Response
    {
        // P2-2.1: payload berat (produk + media + varian) di-cache 5 menit;
        // invalidasi via ProductObserver/ProductVariantObserver (flush tag).
        $product = \App\Support\ProductCache::rememberPdp(
            $parent_sku,
            fn () => Product::visible()
                ->where('parent_sku', $parent_sku)
                ->with([
                    'mainImage',
                    'activeVariants.attributes',
                    'attributes',
                    'media' => fn ($q) => $q->visible()
                        ->catalog()
                        ->where('is_installation', false)
                        ->orderByDesc('is_main_image')
                        ->orderBy('position')
                        ->orderBy('id'),
                    'installationMedia' => fn ($q) => $q->visible()->installation()->with('mediaAsset')->orderBy('position'),
                ])
                ->firstOrFail(),
        );

        if ($request->is('api/*') || $request->wantsJson()) {
            $product->loadMissing(['media' => fn ($q) => $q->visible()->orderBy('position')]);

            return response()->json($product->toApiArray());
        }

        try {
            app(ProductEngagementService::class)->trackView($product->id);
        } catch (\Throwable) {
            // Metrics must not break PDP.
        }

        $activeVariants = $product->activeVariants
            ->sortBy('id')
            ->values();

        $requestedVariantSku = trim((string) $request->query(
            'variant',
            $request->query('variant_sku', '')
        ));
        $selectedVariant = $requestedVariantSku !== ''
            ? $activeVariants->first(
                fn ($variant) => (string) $variant->variant_sku === $requestedVariantSku
            )
            : $activeVariants->first();

        if ($requestedVariantSku !== '' && $selectedVariant === null) {
            abort(404);
        }

        // Ukuran dikunci oleh URL kartu, tetapi opsi non-ukuran (warna/kaca/arah buka)
        // tetap tersedia untuk ukuran tersebut.
        $selectedHeight = $selectedVariant?->height_cm !== null
            ? (float) $selectedVariant->height_cm
            : ($product->height_cm !== null ? (float) $product->height_cm : null);
        $selectedWidth = $selectedVariant?->width_cm !== null
            ? (float) $selectedVariant->width_cm
            : ($product->width_cm !== null ? (float) $product->width_cm : null);

        if ($selectedHeight !== null && $selectedWidth !== null) {
            $matchingVariants = $activeVariants->filter(function ($variant) use ($selectedHeight, $selectedWidth, $product) {
                $vh = $variant->height_cm !== null ? (float) $variant->height_cm : ($product->height_cm !== null ? (float) $product->height_cm : null);
                $vw = $variant->width_cm !== null ? (float) $variant->width_cm : ($product->width_cm !== null ? (float) $product->width_cm : null);
                return $vh !== null && $vw !== null
                    && abs($vh - $selectedHeight) < 0.001
                    && abs($vw - $selectedWidth) < 0.001;
            });

            $detailVariants = ($matchingVariants->isNotEmpty() ? $matchingVariants : $activeVariants)
                ->sortBy(fn ($variant) => $variant->id === $selectedVariant?->id ? 0 : 1)
                ->values();
        } else {
            $detailVariants = $activeVariants
                ->sortBy(fn ($variant) => $variant->id === $selectedVariant?->id ? 0 : 1)
                ->values();
        }

        $categorySlug = CategoryUrl::categoryToSlug((string) $product->product_category);

        $modelLabel = CatalogLabels::model($product->product_model);
        $designLabel = CatalogLabels::design($product->design_variant);
        $categoryLabel = CatalogLabels::category($product->product_category);
        $subtitle = trim(implode(' ', array_filter([
            $categoryLabel !== 'Semua Produk' ? $categoryLabel.' Aluminium' : null,
            $modelLabel,
            $designLabel,
        ])));

        // Sitemap breadcrumb PDP: Semua Model Produk → {kategori model desain} → Produk Satuan
        $isiModelLabel = trim(implode(' ', array_filter([
            $categoryLabel !== 'Semua Produk' ? $categoryLabel : null,
            $modelLabel,
            $designLabel,
        ])));
        $modelSlug = strtolower(str_replace('_', '-', (string) $product->product_model));
        $designSlug = strtolower(str_replace('_', '-', (string) $product->design_variant));
        $categoryHref = route('catalog.category', ['category' => $categorySlug]);
        $isiHref = filled($product->design_variant)
            ? route('catalog.design', ['category' => $categorySlug, 'model' => $modelSlug, 'design' => $designSlug])
            : route('catalog.model', ['category' => $categorySlug, 'model' => $modelSlug]);
        $breadcrumbVariant = $selectedVariant
            ?? $activeVariants->first(fn ($variant) => $variant->height_cm !== null && $variant->width_cm !== null);
        $formatDimension = fn (float $value) => rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
        $breadcrumbProductLabel = $breadcrumbVariant
            ? 'Ukuran '.$formatDimension((float) $breadcrumbVariant->height_cm).' × '.$formatDimension((float) $breadcrumbVariant->width_cm).' cm'
            : 'SKU '.$product->parent_sku;

        // Kontrak naming (2026-09-17): nama produk dari admin adalah nama
        // tampil dan tidak ditimpa. Ukuran varian terpilih dikirim terpisah
        // sebagai size_label/size_dimension (metadata), bukan mengganti nama.
        $detailName = $product->name;
        $detailShortName = $product->short_name;
        $detailSizeLabel = null;
        $detailSizeDimension = null;
        if ($selectedVariant && $selectedVariant->height_cm !== null && $selectedVariant->width_cm !== null) {
            $variantLabel = $isiModelLabel !== '' ? $isiModelLabel : $categoryLabel;
            $detailSizeLabel = trim(sprintf(
                'Tinggi %scm × Panjang %scm %s',
                $formatDimension((float) $selectedVariant->height_cm),
                $formatDimension((float) $selectedVariant->width_cm),
                $variantLabel,
            ));
            $detailSizeDimension = $formatDimension((float) $selectedVariant->height_cm)
                .'x'.$formatDimension((float) $selectedVariant->width_cm);
        }

        return Inertia::render('Public/ProductDetail', [
            'product' => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $detailName,
                'short_name' => $detailShortName,
                'size_label' => $detailSizeLabel,
                'size_dimension' => $detailSizeDimension,
                'description' => $product->description,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
                'sold_count' => (int) ($product->sold_count ?? 0),
                'design_variant' => $product->design_variant,
                'category_label' => $categoryLabel,
                'model_label' => $modelLabel,
                'design_label' => $designLabel,
                'subtitle' => $subtitle !== '' ? $subtitle : $product->name,
                'category_href' => $categoryHref,
                'model_href' => $isiHref,
                'breadcrumbs' => [
                    [
                        'label' => 'Semua Model Produk',
                        'href' => route('catalog.index'),
                    ],
                    [
                        'label' => $isiModelLabel !== '' ? $isiModelLabel : $categoryLabel,
                        'href' => $isiHref,
                    ],
                    [
                        'label' => $breadcrumbProductLabel,
                        'href' => null,
                    ],
                ],
            ],
            'attributes' => $product->attributes
                ->map(fn ($a) => [
                    'name' => $a->attribute_name,
                    'value' => $a->attribute_value,
                ])
                ->values()
                ->all(),
            'variants' => $detailVariants->map(function ($v) use ($product) {
                $priced = app(\App\Services\PriceService::class)->forVariant($v, $product);
                $h = $v->height_cm !== null ? (float) $v->height_cm : ($product->height_cm !== null ? (float) $product->height_cm : null);
                $w = $v->width_cm !== null ? (float) $v->width_cm : ($product->width_cm !== null ? (float) $product->width_cm : null);
                $compact = ($h !== null && $w !== null)
                    ? rtrim(rtrim(number_format($h, 2, '.', ''), '0'), '.').'x'.rtrim(rtrim(number_format($w, 2, '.', ''), '0'), '.')
                    : null;
                $label = ($h !== null && $w !== null)
                    ? 'Tinggi '.rtrim(rtrim(number_format($h, 2, '.', ''), '0'), '.').' cm x Panjang '.rtrim(rtrim(number_format($w, 2, '.', ''), '0'), '.').' cm'
                    : null;

                return [
                    'id' => $v->id,
                    'variant_sku' => $v->variant_sku,
                    'price' => (float) $v->price,
                    'sale_price' => (float) $priced['sale'],
                    'compare_price' => $priced['compare'],
                    'flash_sale' => (bool) $priced['flash_sale'],
                    'stock' => (int) $v->stock,
                    'variation_1_name' => $v->variation_1_name,
                    'variation_1_option' => $v->variation_1_option,
                    'variation_2_name' => $v->variation_2_name,
                    'variation_2_option' => $v->variation_2_option,
                    'height_cm' => $h,
                    'width_cm' => $w,
                    'dimension_compact' => $compact,
                    'dimension_label' => $label,
                    'label' => trim(implode(' / ', array_filter([
                        $v->variation_1_option,
                        $v->variation_2_option,
                    ]))) ?: $v->variant_sku,
                ];
            })->values()->all(),
            'media' => $product->media
                ->unique(fn ($m) => $m->media_asset_id ?: $m->stored_url ?: $m->id)
                ->values()
                ->map(fn ($m) => [
                    'id' => $m->id,
                    'is_video' => $m->mediaAsset?->kind === 'video',
                    // Video: url = file video, thumb = poster frame; gambar: pdp/card.
                    'url' => $m->mediaAsset?->kind === 'video'
                        ? ($m->urlFor('video') ?? $m->urlFor('card'))
                        : ($m->urlFor('pdp') ?? $m->urlFor('card')),
                    'thumb' => $m->mediaAsset?->kind === 'video'
                        ? ($m->urlFor('poster') ?? $m->urlFor('thumb'))
                        : ($m->urlFor('thumb') ?? $m->urlFor('card')),
                    'is_main_image' => (bool) $m->is_main_image,
                    'product_variant_id' => $m->product_variant_id,
                ])->values()->all(),
            'installationMedia' => $product->installationMedia->map(fn ($m) => [
                'id' => $m->id,
                'url' => $m->urlFor('pdp') ?? $m->urlFor('card') ?? $m->source_url,
                'thumb' => $m->urlFor('thumb') ?? $m->urlFor('card'),
                'is_video' => InstallationGallery::isVideoMedia($m),
            ])->values()->all(),
            'reviews' => app(ProductPopularityService::class)
                ->inheritedTestimonials($product)
                ->map(fn (CmsTestimonial $t) => $t->toPublicArray((int) $t->product_id === (int) $product->id))
                ->values()
                ->all(),
            // Section "Anda mungkin juga suka" disembunyikan bila tidak ada isi
            // (relatedUrl null -> frontend tidak merender section sama sekali).
            'relatedProducts' => InertiaCatalog::productCards(
                $relatedProducts = $this->relatedProductsFor($product)
            ),
            'relatedUrl' => $relatedProducts->isEmpty() ? null : $this->relatedListingUrl($product),
            // Metadata promo yang sama dengan product card (compare price, flash sale, COD, garansi).
            'promo' => tap(ProductPromotionMetadata::forProduct($product), function (&$promo) use ($detailVariants, $product) {
                $pricing = app(\App\Services\PriceService::class)->productCard($product);
                $promo['min_price'] = $pricing['min_sale'] ?? $promo['min_price'];
                $promo['compare_price'] = $pricing['compare'] ?? $promo['compare_price'];
                $promo['discount_percent'] = ($pricing['discount_percent'] ?? 0) > 0 ? $pricing['discount_percent'] : $promo['discount_percent'];
                $promo['flash_sale'] = (bool) $pricing['flash_sale'];

                // Jika varian difilter per dimensi (dari URL), min_price harus dari varian yang terlihat saja.
                if ($detailVariants->isNotEmpty()) {
                    $filteredMin = null;
                    foreach ($detailVariants as $v) {
                        $p = app(\App\Services\PriceService::class)->forVariant($v, $product);
                        if ($filteredMin === null || $p['sale'] < $filteredMin) {
                            $filteredMin = $p['sale'];
                        }
                    }
                    $promo['min_price'] = (float) $filteredMin;
                }
            }),
        ]);
    }

    /** Batas kandidat rekomendasi; frontend menampilkan 8 di mobile, 10 di desktop. */
    private const RELATED_PRODUCTS_LIMIT = 10;

    /**
     * Bobot tinggi terhadap panjang saat mengurutkan kedekatan ukuran.
     * Tinggi 2x lebih menentukan (unit harus muat di bukaan), tetapi selisih
     * panjang yang ekstrem tetap dihitung sehingga tidak ada kandidat "sama
     * tinggi tapi beda panjang jauh" yang menang hanya karena tingginya sama.
     */
    private const RELATED_SIZE_HEIGHT_WEIGHT = 2;

    /**
     * Rekomendasi "Anda mungkin juga suka" (maks 10 kandidat; frontend
     * menampilkan 8 di mobile dan 10 di desktop).
     *
     * Prioritas (kontrak owner 2026-09-16, revisi): UKURAN menang atas
     * kecocokan model/submodel, dengan urutan bertingkat:
     *   1. MODEL SAMA - diurutkan JARAK UKURAN TERDEKAT, yaitu
     *      (RELATED_SIZE_HEIGHT_WEIGHT x selisih tinggi) + selisih panjang,
     *      baru desain setipe, baru penjualan.
     *      Tinggi berbobot lebih besar karena unit harus muat di bukaan, tetapi
     *      panjang tetap dihitung sehingga kandidat "tinggi sama namun panjang
     *      beda jauh" (mis. 180x130 vs 180x220) TIDAK menang hanya karena
     *      tingginya sama. "Model sama + ukuran sama" selalu di paling depan
     *      karena jaraknya 0.
     *   2. KATEGORI SAMA - urutan jarak ukuran yang sama.
     *   3. UKURAN SAMA PERSIS lintas kategori/model.
     *   4. Kurasi beranda ("Paling Banyak Dipesan").
     *   5. Seluruh katalog.
     *
     * Bila produk tidak punya ukuran, pengurutan ukuran dilewati dan tinggal
     * desain setipe lalu penjualan. Setiap tingkat hanya mengisi sisa slot dan
     * tidak ada produk kembar.
     *
     * @return Collection<int, Product>
     */
    private function relatedProductsFor(Product $product): Collection
    {
        $limit = self::RELATED_PRODUCTS_LIMIT;
        $exclude = collect([$product->id]);
        $related = collect();

        $take = function (callable $query, int $slots) use (&$exclude, &$related): void {
            if ($slots <= 0) {
                return;
            }

            $batch = $query()
                ->whereNotIn('id', $exclude->all())
                ->with(['mainImage', 'activeVariants.attributes', 'attributes'])
                ->limit($slots)
                ->get();

            foreach ($batch as $item) {
                $related->push($item);
                $exclude->push($item->id);
            }
        };

        $remaining = fn (): int => $limit - $related->count();

        $height = $product->height_cm !== null ? (float) $product->height_cm : null;
        $width = $product->width_cm !== null ? (float) $product->width_cm : null;
        $design = CatalogLabels::normalizeDesign($product->design_variant);
        $hasSize = $height !== null && $width !== null;

        // Urutan standar semua tingkat: ukuran terdekat -> desain setipe -> penjualan.
        $bySizeThenPopularity = function ($query) use ($hasSize, $height, $width, $design) {
            if ($hasSize) {
                // Produk tanpa ukuran jangan dianggap "terdekat" karena
                // ABS(NULL) bernilai NULL dan bisa menyusup ke urutan depan.
                $query->orderByRaw('CASE WHEN height_cm IS NULL OR width_cm IS NULL THEN 1 ELSE 0 END');
                // Kedekatan ukuran = JARAK GABUNGAN berbobot (kontrak owner 2026-09-16):
                // selisih TERDEKAT menang, dengan tinggi berbobot lebih besar
                // daripada panjang. Tinggi saja tidak cukup: kandidat "tinggi sama
                // tetapi panjang beda jauh" (mis. 180x130 vs 180x220) terlalu
                // drastis, sehingga kandidat yang lebih dekat secara keseluruhan
                // harus didahulukan.
                $query->orderByRaw(
                    '(? * ABS(height_cm - ?)) + ABS(width_cm - ?)',
                    [self::RELATED_SIZE_HEIGHT_WEIGHT, $height, $width]
                );
            }

            if ($design !== null) {
                $query->orderByRaw('CASE WHEN design_variant = ? THEN 0 ELSE 1 END', [$design]);
            }

            return $query
                ->withPopularityScore()
                ->orderByRaw(Product::popularityScoreSql().' DESC')
                ->orderByDesc('id');
        };

        // 1. Model sama (ukuran terdekat lebih dulu).
        if ($product->product_model) {
            $take(
                fn () => $bySizeThenPopularity(
                    Product::visible()->where('product_model', $product->product_model)
                ),
                $remaining()
            );
        }

        // 2. Kategori sama.
        if ($remaining() > 0 && $product->product_category) {
            $take(
                fn () => $bySizeThenPopularity(
                    Product::visible()->where('product_category', $product->product_category)
                ),
                $remaining()
            );
        }

        // 3. Ukuran sama persis dari model/kategori lain (kecocokan paling kuat
        //    setelah model, karena ukuran menentukan produk bisa dipasang).
        if ($remaining() > 0 && $hasSize) {
            $take(
                fn () => $bySizeThenPopularity(
                    Product::visible()
                        ->where('height_cm', $height)
                        ->where('width_cm', $width)
                ),
                $remaining()
            );
        }

        // 4. Kurasi beranda - urutan kurasi admin dipertahankan.
        if ($remaining() > 0) {
            $take(
                fn () => Product::visible()
                    ->homepagePopular()
                    ->withPopularityScore()
                    ->orderBy('homepage_popular_sort')
                    ->orderByDesc('id'),
                $remaining()
            );
        }

        // 5. Seluruh katalog.
        if ($remaining() > 0) {
            $take(fn () => $bySizeThenPopularity(Product::visible()), $remaining());
        }

        return $related->take($limit)->values();
    }
    /**
     * URL "Lihat semua" untuk rekomendasi: halaman listing dengan filter aktif
     * (kategori + model + sub model) supaya isi halaman tujuan sinkron dengan
     * section yang diklik. Desain dihilangkan bila produk itu tidak punya
     * sub model.
     */
    protected function relatedListingUrl(Product $product)
    {
        $category = (string) $product->product_category;
        $model = (string) $product->product_model;
        $design = CatalogLabels::normalizeDesign($product->design_variant);

        if ($category === '' || $model === '') {
            return route('catalog.all', absolute: false);
        }

        $params = [
            'category' => CategoryUrl::categoryToSlug($category),
            'model' => strtolower(str_replace('_', '-', $model)),
        ];

        if ($design !== null) {
            return route('catalog.design', $params + [
                'design' => strtolower(str_replace('_', '-', $design)),
            ], absolute: false);
        }

        return route('catalog.model', $params, absolute: false);
    }
}
