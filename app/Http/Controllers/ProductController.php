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
        $product = Product::visible()
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
                'installationMedia' => fn ($q) => $q->visible()->installation()->orderBy('position'),
            ])
            ->firstOrFail();

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
        if ($selectedVariant && $selectedVariant->height_cm !== null && $selectedVariant->width_cm !== null) {
            $selectedHeight = (float) $selectedVariant->height_cm;
            $selectedWidth = (float) $selectedVariant->width_cm;
            $detailVariants = $activeVariants
                ->filter(
                    fn ($variant) => abs((float) $variant->height_cm - $selectedHeight) < 0.001
                        && abs((float) $variant->width_cm - $selectedWidth) < 0.001
                )
                ->sortBy(fn ($variant) => $variant->id === $selectedVariant->id ? 0 : 1)
                ->values();
        } else {
            $detailVariants = $selectedVariant ? collect([$selectedVariant]) : collect();
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

        $detailName = $product->name;
        $detailShortName = $product->short_name;
        if ($selectedVariant && $selectedVariant->height_cm !== null && $selectedVariant->width_cm !== null) {
            $detailName = sprintf(
                'Tinggi %scm × Panjang %scm %s',
                $formatDimension((float) $selectedVariant->height_cm),
                $formatDimension((float) $selectedVariant->width_cm),
                $isiModelLabel !== '' ? $isiModelLabel : $categoryLabel,
            );
            $detailShortName = $formatDimension((float) $selectedVariant->height_cm)
                .'x'.$formatDimension((float) $selectedVariant->width_cm);
        }

        return Inertia::render('Public/ProductDetail', [
            'product' => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $detailName,
                'short_name' => $detailShortName,
                'description' => $product->description,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
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
                $h = $v->height_cm !== null ? (float) $v->height_cm : null;
                $w = $v->width_cm !== null ? (float) $v->width_cm : null;
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
            'media' => $product->media->map(fn ($m) => [
                'id' => $m->id,
                'url' => $m->urlFor('pdp') ?? $m->urlFor('card'),
                'thumb' => $m->urlFor('thumb') ?? $m->urlFor('card'),
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
            'relatedProducts' => InertiaCatalog::productCards(
                $this->relatedProductsFor($product)
            ),
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

    /**
     * Same model → same category → homepage popular / website sales. Max 8.
     *
     * @return Collection<int, Product>
     */
    private function relatedProductsFor(Product $product): Collection
    {
        $exclude = collect([$product->id]);
        $related = collect();

        $take = function (callable $query, int $limit) use (&$exclude, &$related): void {
            if ($limit <= 0) {
                return;
            }
            $batch = $query()
                ->whereNotIn('id', $exclude->all())
                ->with(['mainImage', 'activeVariants', 'attributes'])
                ->limit($limit)
                ->get();
            foreach ($batch as $p) {
                $related->push($p);
                $exclude->push($p->id);
            }
        };

        if ($product->product_model) {
            $take(
                fn () => Product::visible()
                    ->where('product_model', $product->product_model)
                    ->orderByWebsiteSales(),
                8
            );
        }

        if ($related->count() < 8 && $product->product_category) {
            $take(
                fn () => Product::visible()
                    ->where('product_category', $product->product_category)
                    ->orderByWebsiteSales(),
                8 - $related->count()
            );
        }

        if ($related->count() < 8) {
            $curated = Product::visible()
                ->homepagePopular()
                ->whereNotIn('id', $exclude->all())
                ->with(['mainImage', 'activeVariants', 'attributes'])
                ->withPopularityScore()
                ->orderBy('homepage_popular_sort')
                ->orderByDesc('id')
                ->limit(8 - $related->count())
                ->get();
            foreach ($curated as $p) {
                $related->push($p);
                $exclude->push($p->id);
            }
        }

        if ($related->count() < 8) {
            $take(
                fn () => Product::visible()->orderByWebsiteSales(),
                8 - $related->count()
            );
        }

        return $related->take(8)->values();
    }
}
