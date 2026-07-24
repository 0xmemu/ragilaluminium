<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Support\Collection;

class InertiaCatalog
{
    public static function productCard(Product $product): array
    {
        $promo = ProductPromotionMetadata::forProduct($product);

        return [
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
            // Relative URLs keep Inertia on the current origin/scheme (critical behind Cloudflare HTTPS).
            'href' => route('product.show', $product->parent_sku, absolute: false),
            'installation_href' => ((bool) ($product->has_installation_gallery ?? false))
                ? route('installation.show', ['parent_sku' => $product->parent_sku], absolute: false)
                : null,
        ];
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
}
