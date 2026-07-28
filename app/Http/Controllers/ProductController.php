<?php

namespace App\Http\Controllers;

use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Services\ProductEngagementService;
use App\Support\CatalogLabels;
use App\Support\InertiaCatalog;
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
                'media' => fn ($q) => $q->visible()->catalog()->orderBy('position'),
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

        $categoryRoute = match ($product->product_category) {
            'WINDOW' => 'catalog.windows',
            'DOOR' => 'catalog.doors',
            'BOUVEN' => 'catalog.bouven',
            default => 'catalog.index',
        };

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
        $categoryHref = route($categoryRoute);
        $isiHref = route($categoryRoute, array_filter([
            'model' => $product->product_model,
            'design' => $product->design_variant,
        ]));
        $productTitle = trim((string) ($product->name ?: $product->short_name));

        return Inertia::render('Public/ProductDetail', [
            'product' => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $product->name,
                'short_name' => $product->short_name,
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
                        'label' => $productTitle,
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
            'variants' => $product->activeVariants->map(function ($v) {
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
                'url' => $m->urlFor('pdp') ?? $m->urlFor('card'),
                'thumb' => $m->urlFor('thumb') ?? $m->urlFor('card'),
            ])->values()->all(),
            'reviews' => CmsTestimonial::query()
                ->published()
                ->forProduct($product->id)
                ->with('product:id,parent_sku,name,short_name')
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->limit(20)
                ->get()
                ->map(fn (CmsTestimonial $t) => $t->toPublicArray())
                ->values()
                ->all(),
            'relatedProducts' => InertiaCatalog::productCards(
                $this->relatedProductsFor($product)
            ),
            // Metadata promo yang sama dengan product card (compare price, flash sale, COD, garansi).
            'promo' => ProductPromotionMetadata::forProduct($product),
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
                ->withExists([
                    'installationMedia as has_installation_gallery' => fn ($q) => $q->visible(),
                ])
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
                ->withExists([
                    'installationMedia as has_installation_gallery' => fn ($q) => $q->visible(),
                ])
                ->withSum('orderItems as sold_count', 'quantity')
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
