<?php

namespace App\Support;

use App\Models\CmsBanner;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class HomepagePromotions
{
    public static function productSkuFromUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || ! preg_match('~^/product/([^/]+)/?$~', $path, $matches)) {
            return null;
        }

        return rawurldecode($matches[1]);
    }

    public static function productImageFromUrl(?string $url): ?string
    {
        $sku = self::productSkuFromUrl($url);
        if (! $sku) {
            return null;
        }

        $product = Product::visible()->with('mainImage')->where('parent_sku', $sku)->first();

        return $product?->mainImage?->urlFor('card')
            ?: $product?->mainImage?->urlFor('pdp');
    }

    /**
     * Landing slide always first, then manual published banners, then automatic
     * promo product slides when enabled. Promo fallbacks only when both empty.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function slides(): array
    {
        // 10 slot banner: banner manual dari admin (cms_banners) tampil lebih
        // dulu, sisanya placeholder polos sampai total 10. Admin tinggal mengisi
        // gambar banner sendiri untuk tiap slot.
        $slides = self::manualSlides();
        $count = count($slides);
        for ($i = $count; $i < 10; $i++) {
            $slides[] = [
                'id' => -3000 - $i,
                'source' => 'placeholder',
                'layout' => 'placeholder',
                'eyebrow' => null,
                'headline' => '',
                'subheadline' => null,
                'accent' => null,
                'image' => null,
                'image_alt' => 'Banner promosi',
                'href' => route('catalog.index', absolute: false),
                'disclaimer' => null,
                'sticker' => false,
            ];
        }

        return array_slice($slides, 0, 10);
    }

    /**
     * Count of currently eligible automatic candidates (for admin UI).
     */
    public static function automaticCandidateCount(): int
    {
        return self::eligibleProducts()->count();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function manualSlides(): array
    {
        /** @var Collection<int, CmsBanner> $banners */
        $banners = CmsBanner::published()->with('mediaAsset')->orderBy('sort_order')->orderBy('id')->get();
        if ($banners->isEmpty()) {
            return [];
        }

        $skus = $banners
            ->map(fn (CmsBanner $banner) => self::productSkuFromUrl($banner->link_url))
            ->filter()
            ->unique()
            ->values();

        $products = Product::visible()
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->whereIn('parent_sku', $skus)
            ->get()
            ->keyBy('parent_sku');

        return $banners->map(function (CmsBanner $banner) use ($products): array {
            $sku = self::productSkuFromUrl($banner->link_url);
            /** @var Product|null $product */
            $product = $sku ? $products->get($sku) : null;
            $promo = $product ? ProductPromotionMetadata::forProduct($product) : null;
            $copy = self::copy($banner->title, $product, $promo);

            $image = $banner->mediaAsset?->localUrlFor('pdp')
                ?: $banner->mediaAsset?->localUrlFor('card')
                ?: $banner->mediaAsset?->localUrlFor('thumb')
                ?: $product?->mainImage?->localUrlFor('pdp')
                ?: $product?->mainImage?->localUrlFor('card')
                ?: $product?->mainImage?->urlFor('pdp')
                ?: $product?->mainImage?->urlFor('card')
                ?: $banner->image_url;

            return [
                'id' => $banner->id,
                'source' => 'manual',
                'layout' => 'promo_card',
                'sticker' => true,
                'eyebrow' => $copy['eyebrow'],
                'headline' => $copy['headline'],
                'subheadline' => $copy['subheadline'],
                'accent' => $copy['accent'] ?? ((($promo['discount_percent'] ?? 0) > 0) ? '-'.$promo['discount_percent'].'%' : null),
                'image' => $image,
                'image_alt' => $product?->name ?: ($banner->title ?: 'Promo Ragil Aluminium'),
                'href' => $banner->link_url ?: ($product ? route('product.show', $product->parent_sku, absolute: false) : route('catalog.index', absolute: false)),
                'disclaimer' => '*Untuk berbagai produk pilihan',
            ];
        })->values()->all();
    }

    /**
     * @param  list<string>  $excludeSkus
     * @return array<int, array<string, mixed>>
     */
    private static function automaticSlides(array $excludeSkus, int $limit): array
    {
        $exclude = array_fill_keys($excludeSkus, true);

        return self::eligibleProducts()
            ->filter(fn (Product $product) => ! isset($exclude[$product->parent_sku]))
            ->take($limit)
            ->values()
            ->map(function (Product $product, int $index): array {
                $promo = ProductPromotionMetadata::forProduct($product, applyGlobalEventDiscount: false);
                $categoryLabel = self::categoryLabel($product->product_category);
                $discount = $promo['discount_percent'];

                return [
                    'id' => -1000 - $index,
                    'source' => 'automatic',
                    'layout' => 'promo_card',
                    'eyebrow' => $discount ? 'Promo Diskon' : 'Promo',
                    'headline' => self::modelHeadline($product),
                    'subheadline' => 'Harga miring, kualitas terjamin',
                    'accent' => $discount ? '-'.$discount.'%' : null,
                    'image' => self::productMediaUrl($product),
                    'image_alt' => self::modelHeadline($product, multiline: false),
                    'href' => self::modelListingHref($product),
                    'disclaimer' => '*Promo model '.$categoryLabel.' pilihan',
                    'sticker' => true,
                ];
            })
            ->all();
    }

    /**
     * @return Collection<int, Product>
     */
    private static function eligibleProducts(): Collection
    {
        return Product::visible()
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->withPopularityScore()
            ->whereHas('activeVariants', fn ($q) => $q->where('price', '>', 0))
            ->whereHas('mainImage')
            ->where(function ($query) {
                $query->whereHas('attributes', function ($attr) {
                    $attr->whereIn('attribute_name', [
                        'promo_compare_price',
                        'compare_price',
                        'harga_asli',
                        'harga_sebelum_diskon',
                    ]);
                })->orWhereHas('attributes', function ($attr) {
                    $attr->whereIn('attribute_name', ['promo_flash_sale', 'flash_sale'])
                        ->whereIn('attribute_value', ['1', 'true', 'TRUE', 'True', 'yes', 'YES', 'on', 'ON']);
                });
            })
            ->orderByDesc('homepage_popular')
            ->orderBy('homepage_popular_sort')
            ->orderByRaw(Product::popularityScoreSql().' DESC')
            ->orderByDesc('id')
            ->limit(24)
            ->get()
            ->filter(fn (Product $product) => ProductPromotionMetadata::isEligibleForAutoBanner($product))
            ->sortBy(function (Product $product) {
                // Prefer newest BOUVEN for banner imagery, then curated/popular, then discount.
                $bouvenRank = self::isBouven($product->product_category) ? '0' : '1';
                $popularRank = $product->homepage_popular ? '0' : '1';
                $sort = str_pad((string) (int) ($product->homepage_popular_sort ?? 9999), 6, '0', STR_PAD_LEFT);
                $discount = str_pad((string) (1000 - (int) (ProductPromotionMetadata::forProduct($product, applyGlobalEventDiscount: false)['discount_percent'] ?? 0)), 4, '0', STR_PAD_LEFT);
                $sold = str_pad((string) (1000000 - ((int) ($product->sold_count ?? 0) + (int) ($product->popularity_seed ?? 0))), 7, '0', STR_PAD_LEFT);
                $id = str_pad((string) (1000000000 - $product->id), 10, '0', STR_PAD_LEFT);

                return $bouvenRank.$popularRank.$sort.$discount.$sold.$id;
            })
            ->values();
    }

    /**
     * @param  array<int, array<string, mixed>>  $slides
     * @return list<string>
     */
    private static function skusFromSlides(array $slides): array
    {
        return collect($slides)
            ->map(fn (array $slide) => self::productSkuFromUrl($slide['href'] ?? null))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Permanent first slide (brand landing); promos never replace it.
     *
     * @return array<string, mixed>
     */
    private static function landingSlide(): array
    {
        return [
            'id' => 0,
            'source' => 'fallback',
            'layout' => 'landing',
            'eyebrow' => 'PROMO BOVEN JUNGKIT',
            'headline' => 'Diskon 20%',
            'subheadline' => 'Hanya Hari Ini !',
            'accent' => null,
            'image' => '/images/home/model-casement.png',
            'image_alt' => 'Promo bouven jungkit',
            'href' => PublicNavigation::canonicalHref('catalog.bouven', [], false),
        ];
    }

    /**
     * Campaign slides when CMS + auto promos empty.
     * Prefer real newest BOUVEN (then DOOR) product photos — never static dummy promo art.
     *
     * @return array<int, array<string, mixed>>
     */
    private static function fallbackSlides(): array
    {
        $slides = [self::landingSlide()];

        $bouven = self::newestCategoryProduct('BOUVEN');
        if ($bouven !== null) {
            $slides[] = self::productShowcaseSlide($bouven, id: -1);
        }

        $door = self::newestCategoryProduct('DOOR');
        if ($door !== null) {
            $slides[] = self::productShowcaseSlide($door, id: -2);
        }

        return $slides;
    }

    /**
     * Newest visible product in category that has a real main image.
     */
    private static function newestCategoryProduct(string $category): ?Product
    {
        $aliases = match (strtoupper($category)) {
            'BOUVEN', 'BOVEN' => ['BOUVEN', 'BOVEN'],
            default => [strtoupper($category)],
        };

        return Product::visible()
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->whereIn('product_category', $aliases)
            ->whereHas('mainImage')
            ->whereHas('activeVariants', fn ($q) => $q->where('price', '>', 0))
            ->latest('created_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Real product slide for empty-promo fallback (promo accent only when attributes exist).
     *
     * @return array<string, mixed>
     */
    private static function productShowcaseSlide(Product $product, int $id): array
    {
        $promo = ProductPromotionMetadata::forProduct($product, applyGlobalEventDiscount: false);
        $image = self::productMediaUrl($product);
        $categoryLabel = self::categoryLabel($product->product_category);
        $discount = $promo['discount_percent'];
        $isPromo = (bool) $discount || ($promo['has_explicit_promo'] ?? false);

        return [
            'id' => $id,
            'source' => 'fallback',
            'layout' => 'promo_card',
            'sticker' => true,
            'eyebrow' => $isPromo ? 'Promo Diskon' : $categoryLabel,
            'headline' => self::modelHeadline($product),
            'subheadline' => $isPromo
                ? 'Harga miring, kualitas terjamin'
                : 'Model '.$categoryLabel.' terbaru di katalog',
            'accent' => $discount ? '-'.$discount.'%' : null,
            'image' => $image,
            'image_alt' => self::modelHeadline($product, multiline: false),
            'href' => self::modelListingHref($product),
            'disclaimer' => $isPromo
                ? '*Promo model '.$categoryLabel.' pilihan'
                : '*Gambar produk '.$categoryLabel.' model terbaru',
        ];
    }

    /**
     * Banner headline = kategori + model (Jungkit / Swing), bukan ukuran SKU.
     */
    private static function modelHeadline(Product $product, bool $multiline = true): string
    {
        $category = self::categoryLabel($product->product_category);
        $model = CatalogLabels::model($product->product_model);
        if ($model === '' && filled($product->product_model)) {
            $model = (string) $product->product_model;
        }

        if ($category !== '' && $category !== 'Produk' && $model !== '') {
            return $multiline ? $category."\n".$model : $category.' '.$model;
        }

        if ($model !== '') {
            return $model;
        }

        if ($category !== '' && $category !== 'Produk') {
            return $category;
        }

        // Last resort: avoid dimension-like short names (e.g. 110x70).
        $fallback = trim((string) ($product->short_name ?: $product->name ?: 'Promo'));
        if (preg_match('/^\d{2,4}\s*[x×]\s*\d{2,4}$/iu', $fallback)) {
            return 'Produk Aluminium';
        }

        return Str::limit($fallback, 42, '');
    }

    /**
     * Promo CTA opens the model listing (promo is model-scoped, not a single size SKU).
     */
    private static function modelListingHref(Product $product): string
    {
        $model = CatalogLabels::normalizeModel($product->product_model);
        $route = match (strtoupper((string) $product->product_category)) {
            'WINDOW', 'WINDOWS' => 'catalog.windows',
            'DOOR', 'DOORS' => 'catalog.doors',
            'BOUVEN', 'BOVEN' => 'catalog.bouven',
            default => null,
        };

        if ($route && $model) {
            return PublicNavigation::canonicalHref($route, ['model' => $model], false);
        }

        if ($route) {
            return PublicNavigation::canonicalHref($route, [], false);
        }

        return route('product.show', $product->parent_sku, absolute: false);
    }

    private static function productMediaUrl(Product $product): ?string
    {
        return $product->mainImage?->localUrlFor('pdp')
            ?: $product->mainImage?->localUrlFor('card')
            ?: $product->mainImage?->urlFor('pdp')
            ?: $product->mainImage?->urlFor('card');
    }

    private static function isBouven(?string $category): bool
    {
        return in_array(strtoupper((string) $category), ['BOUVEN', 'BOVEN'], true);
    }

    /**
     * @param  array{compare_price: float|null, discount_percent: int|null, flash_sale: bool, has_explicit_promo?: bool}|null  $promo
     * @return array{eyebrow: string, headline: string, subheadline: string|null, accent: string|null}
     */
    private static function copy(?string $title, ?Product $product, ?array $promo): array
    {
        $raw = trim($title ?: 'Promo Spesial');
        $accent = null;

        if (preg_match('/(-?\d{1,3})\s*%/', $raw, $match)) {
            $accent = str_starts_with($match[1], '-') ? $match[1].'%' : '-'.$match[1].'%';
        }

        if (! $accent && ($promo['discount_percent'] ?? null)) {
            $accent = '-'.$promo['discount_percent'].'%';
        }

        $subheadline = $accent || ($promo['has_explicit_promo'] ?? false)
            ? 'Harga miring, kualitas terjamin'
            : null;

        $displayHeadline = $product
            ? self::modelHeadline($product)
            : Str::ucfirst(Str::lower(trim(preg_replace('/\s*-?\s*(\d{1,3})\s*%\s*/', ' ', $raw) ?? '') ?: 'Diskon sampai'));

        return [
            'eyebrow' => $accent || ($promo['has_explicit_promo'] ?? false) ? 'Promo Diskon' : 'Promo',
            'headline' => $displayHeadline,
            'subheadline' => $subheadline,
            'accent' => $accent,
        ];
    }

    private static function categoryLabel(?string $category): string
    {
        return match (strtoupper((string) $category)) {
            'WINDOW', 'WINDOWS' => 'Jendela',
            'DOOR', 'DOORS' => 'Pintu',
            'BOUVEN', 'BOVEN' => 'Boven',
            default => 'Produk',
        };
    }
}
