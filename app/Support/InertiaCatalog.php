<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;

class InertiaCatalog
{
    public static function productCard(Product $product): array
    {
        $promo = ProductPromotionMetadata::forProduct($product);

        $card = [
            'id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'short_name' => $product->short_name,
            'product_category' => $product->product_category,
            'product_model' => $product->product_model,
            'design_variant' => $product->design_variant,
            'min_price' => $promo['min_price'],
            'compare_price' => $promo['compare_price'],
            'discount_percent' => $promo['discount_percent'],
            'sold_count' => (int) ($product->sold_count ?? 0),
            'flash_sale' => $promo['flash_sale'],
            'cod_eligible' => $promo['cod_eligible'],
            'warranty_label' => $promo['warranty_label'],
            'image' => self::cardImage($product),
            'href' => route('product.show', $product->parent_sku, absolute: false),
        ];

        // Product storefront selalu menunjuk ke satu ukuran konkret jika dimensinya tersedia.
        $variant = $product->relationLoaded('activeVariants')
            ? $product->activeVariants
                ->sortBy('id')
                ->first(fn ($item) => $item instanceof ProductVariant
                    && (float) ($item->height_cm ?? 0) > 0
                    && (float) ($item->width_cm ?? 0) > 0)
            : null;

        if ($variant) {
            $heightLabel = rtrim(rtrim(number_format((float) $variant->height_cm, 2, '.', ''), '0'), '.');
            $widthLabel = rtrim(rtrim(number_format((float) $variant->width_cm, 2, '.', ''), '0'), '.');
            $line = trim(implode(' ', array_filter([
                CatalogLabels::category($product->product_category),
                CatalogLabels::model($product->product_model),
                CatalogLabels::designSuffix($product->design_variant),
            ])));

            $card['name'] = trim(sprintf(
                'Tinggi %scm × Panjang %scm%s',
                $heightLabel,
                $widthLabel,
                $line !== '' ? ' '.$line : '',
            ));
            $card['short_name'] = $heightLabel.'x'.$widthLabel;
            $card = self::applyVariantPromotion($card, $promo, (float) $variant->price);
            $card['variant_sku'] = $variant->variant_sku;
            $card['card_key'] = $product->parent_sku.'-'.$variant->id;
            $card['href'] = route('product.show', $product->parent_sku, absolute: false)
                .'?'.http_build_query(['variant' => $variant->variant_sku]);

        }

        return $card;
    }

    public static function cardImage(Product $product): string
    {
        $placeholder = '/'.ltrim((string) config('media.placeholder', 'images/home/product-flash.png'), '/');

        if ($product->relationLoaded('mainImage') && $product->mainImage) {
            return $product->mainImage->urlFor('card') ?? $placeholder;
        }

        if ($product->relationLoaded('media')) {
            $fallback = $product->media
                ->first(fn ($m) => $m->show_in_catalog && $m->visibility === 'visible' && $m->status === 'downloaded');

            if ($fallback) {
                return $fallback->urlFor('card') ?? $placeholder;
            }
        }

        return $placeholder;
    }

    /** @param  Collection<int, Product>|iterable<Product>  $products */
    public static function productCards(iterable $products): array
    {
        return collect($products)->map(fn (Product $p) => self::productCard($p))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function sizeCard(Product $product, ProductVariant $variant): array
    {
        $card = self::productCard($product);
        $promo = ProductPromotionMetadata::forProduct($product);
        $height = (float) ($variant->height_cm ?? 0);
        $width = (float) ($variant->width_cm ?? 0);
        $heightLabel = rtrim(rtrim(number_format($height, 2, '.', ''), '0'), '.');
        $widthLabel = rtrim(rtrim(number_format($width, 2, '.', ''), '0'), '.');

        $line = trim(implode(' ', array_filter([
            CatalogLabels::category($product->product_category),
            CatalogLabels::model($product->product_model),
            CatalogLabels::designSuffix($product->design_variant),
        ])));

        $card['name'] = trim(sprintf(
            'Tinggi %scm × Panjang %scm%s',
            $heightLabel,
            $widthLabel,
            $line !== '' ? ' '.$line : '',
        ));
        $card['short_name'] = $heightLabel.'x'.$widthLabel;
        $card = self::applyVariantPromotion($card, $promo, (float) $variant->price);
        $card['variant_sku'] = $variant->variant_sku;
        $card['card_key'] = $product->parent_sku.'-'.$variant->id;

        $baseHref = route('product.show', $product->parent_sku, absolute: false);
        $card['href'] = filled($variant->variant_sku)
            ? $baseHref.'?'.http_build_query(['variant' => $variant->variant_sku])
            : $baseHref;

        return $card;
    }

    /**
     * Unique ukuran terurut tinggi→panjang.
     * Harga = termurah; foto/nama kartu prefer listing khusus ukuran itu (bukan parent TxP).
     *
     * @param  Collection<int, Product>|iterable<Product>  $products
     * @return list<array<string, mixed>>
     */
    public static function sizeCardsForRail(iterable $products, int $limit = 12): array
    {
        $bySize = [];

        foreach ($products as $product) {
            if (! $product instanceof Product || ! $product->relationLoaded('activeVariants')) {
                continue;
            }

            $variantCount = $product->activeVariants->count();
            $uniqueSizes = $product->activeVariants
                ->map(fn (ProductVariant $v) => round((float) ($v->height_cm ?? 0), 2).'x'.round((float) ($v->width_cm ?? 0), 2))
                ->filter(fn (string $k) => ! str_starts_with($k, '0x') && $k !== '0x0')
                ->unique()
                ->count();

            foreach ($product->activeVariants as $variant) {
                if (! $variant instanceof ProductVariant) {
                    continue;
                }

                $height = (float) ($variant->height_cm ?? 0);
                $width = (float) ($variant->width_cm ?? 0);
                if ($height <= 0 || $width <= 0) {
                    continue;
                }

                $key = round($height, 2).'x'.round($width, 2);
                $price = (float) $variant->price;
                $displayScore = self::sizeDisplayScore($product, $height, $width, $uniqueSizes, $variantCount);
                $existing = $bySize[$key] ?? null;

                if ($existing === null) {
                    $bySize[$key] = [
                        'product' => $product,
                        'variant' => $variant,
                        'height' => $height,
                        'width' => $width,
                        'price' => $price,
                        'display_score' => $displayScore,
                    ];

                    continue;
                }

                if ($price < $existing['price'] - 0.01) {
                    $existing['price'] = $price;
                    $existing['variant'] = $variant;
                }

                if ($displayScore > $existing['display_score']) {
                    $existing['product'] = $product;
                    $existing['display_score'] = $displayScore;
                    if (abs($price - $existing['price']) < 0.01) {
                        $existing['variant'] = $variant;
                    }
                }

                $bySize[$key] = $existing;
            }
        }

        uasort(
            $bySize,
            static fn (array $a, array $b): int => [$a['height'], $a['width'], $a['price']]
                <=> [$b['height'], $b['width'], $b['price']]
        );

        $cards = [];
        foreach (array_slice(array_values($bySize), 0, $limit) as $row) {
            $card = self::sizeCard($row['product'], $row['variant']);
            $card['min_price'] = $row['price'];
            $cards[] = $card;
        }

        return $cards;
    }

    /**
     * Product-level compare price represents the discount rate. Apply that same
     * rate to every concrete size so a Flash Sale card never loses its discount
     * merely because the selected size costs more than the cheapest variant.
     *
     * @param  array<string, mixed>  $card
     * @param  array<string, mixed>  $promo
     * @return array<string, mixed>
     */
    protected static function applyVariantPromotion(array $card, array $promo, float $variantPrice): array
    {
        $card['min_price'] = $variantPrice;
        $discountPercent = (int) ($promo['discount_percent'] ?? 0);
        $hasPercentageDiscount = $promo['compare_price'] !== null
            && $discountPercent > 0
            && $discountPercent < 100;

        if ($hasPercentageDiscount) {
            $card['compare_price'] = round($variantPrice / (1 - ($discountPercent / 100)));
            $card['discount_percent'] = $discountPercent;

            return $card;
        }

        $comparePrice = isset($promo['compare_price']) ? (float) $promo['compare_price'] : null;
        if ($comparePrice !== null && $comparePrice > $variantPrice) {
            $card['compare_price'] = $comparePrice;
            $card['discount_percent'] = (int) round(
                (($comparePrice - $variantPrice) / $comparePrice) * 100
            );

            return $card;
        }

        $card['compare_price'] = null;
        $card['discount_percent'] = null;

        return $card;
    }

    protected static function sizeDisplayScore(
        Product $product,
        float $height,
        float $width,
        int $uniqueSizes,
        int $variantCount,
    ): int {
        $score = 0;
        $name = mb_strtoupper((string) $product->name);
        $h = rtrim(rtrim(number_format($height, 2, '.', ''), '0'), '.');
        $w = rtrim(rtrim(number_format($width, 2, '.', ''), '0'), '.');

        if (preg_match('/\b'.preg_quote($h, '/').'\s*[x×]\s*'.preg_quote($w, '/').'\b/u', $name) === 1) {
            $score += 50;
        }
        if (str_contains($name, 'TINGGI '.$h) && str_contains($name, 'PANJANG '.$w)) {
            $score += 40;
        }
        if ($uniqueSizes === 1) {
            $score += 30;
        }
        if (! str_contains($name, '(TXP)')) {
            $score += 20;
        }
        // Listing khusus lebih kecil skornya tinggi; TxP besar turun.
        $score += max(0, 20 - (int) floor($variantCount / 12));

        if ($product->relationLoaded('mainImage') && $product->mainImage) {
            $score += 5;
        }

        return $score;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function popularProductCards(int $limit = 10): array
    {
        $with = ['mainImage', 'media', 'activeVariants', 'attributes'];

        $products = Product::visible()
            ->homepagePopular()
            ->with($with)
            ->withSum('validOrderItems as sold_count', 'quantity')
            ->orderBy('homepage_popular_sort')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        if ($products->isEmpty()) {
            $products = Product::visible()
                ->with($with)
                ->withSum('validOrderItems as sold_count', 'quantity')
                ->orderByWebsiteSales()
                ->limit($limit)
                ->get();
        }

        return self::productCards($products);
    }
}
