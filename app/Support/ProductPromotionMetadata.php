<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Support\Collection;

/**
 * Shared product promotion metadata for storefront cards and homepage banners.
 *
 * Explicit product attributes are the source of truth for "promo sedang berjalan".
 * Global STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT only fills compare price / flash badge
 * for product cards — it does not make a product eligible for automatic banners.
 */
class ProductPromotionMetadata
{
    /**
     * @return array{
     *     compare_price: float|null,
     *     discount_percent: int|null,
     *     flash_sale: bool,
     *     cod_eligible: bool,
     *     warranty_label: string,
     *     min_price: float|null,
     *     has_explicit_promo: bool
     * }
     */
    public static function forProduct(
        Product $product,
        bool $applyGlobalEventDiscount = true,
        bool $respectFlashPeriod = true,
    ): array
    {
        $attributes = $product->relationLoaded('attributes')
            ? $product->getRelation('attributes')
                ->mapWithKeys(fn ($attribute) => [strtolower(trim($attribute->attribute_name)) => trim($attribute->attribute_value)])
            : collect();

        $price = $product->min_price ?? $product->activeVariants?->min('price');
        $comparePrice = self::moneyAttribute($attributes, [
            'promo_compare_price',
            'compare_price',
            'harga_asli',
            'harga_sebelum_diskon',
        ]);
        $hasExplicitCompare = $comparePrice !== null;
        $hasExplicitFlash = self::hasAttribute($attributes, ['promo_flash_sale', 'flash_sale']);

        $eventDiscount = $applyGlobalEventDiscount
            ? max(0, min(90, (int) config('storefront.product_card_discount_percent', 0)))
            : 0;

        $flashSale = self::booleanAttribute(
            $attributes,
            ['promo_flash_sale', 'flash_sale'],
            $eventDiscount > 0
        );

        // Harga coret dari event global tetap boleh tampil di luar periode Flash Sale.
        if ($comparePrice === null && is_numeric($price) && $eventDiscount > 0) {
            $comparePrice = round((float) $price / (1 - ($eventDiscount / 100)));
        }

        // Label Flash Sale di storefront hanya saat periode kampanye live.
        if ($flashSale && $respectFlashPeriod && ! FlashSalePeriodSettings::isLive()) {
            $flashSale = false;
        }

        $hasDiscount = is_numeric($price) && $comparePrice !== null && $comparePrice > (float) $price;
        $codEligible = self::booleanAttribute($attributes, ['promo_cod', 'cod'], true);
        $warrantyLabel = self::attribute($attributes, ['promo_warranty', 'warranty', 'garansi']) ?: 'Garansi 100%';
        $hasExplicitFlashAttr = $hasExplicitFlash && self::booleanAttribute(
            $attributes,
            ['promo_flash_sale', 'flash_sale'],
            false
        );

        return [
            'compare_price' => $hasDiscount ? $comparePrice : null,
            'discount_percent' => $hasDiscount
                ? (int) round((($comparePrice - (float) $price) / $comparePrice) * 100)
                : null,
            'flash_sale' => $flashSale,
            'cod_eligible' => $codEligible,
            'warranty_label' => $warrantyLabel,
            'min_price' => is_numeric($price) ? (float) $price : null,
            'has_explicit_promo' => $hasExplicitCompare || ($hasExplicitFlashAttr && (
                ! $respectFlashPeriod || FlashSalePeriodSettings::isLive()
            )),
        ];
    }

    /**
     * Automatic banners require an explicit product promo attribute (not global env).
     */
    public static function isEligibleForAutoBanner(Product $product): bool
    {
        $meta = self::forProduct($product, applyGlobalEventDiscount: false);
        if (! $meta['has_explicit_promo']) {
            return false;
        }
        if ($meta['min_price'] === null || $meta['min_price'] <= 0) {
            return false;
        }
        if (! $product->relationLoaded('mainImage') || ! $product->mainImage) {
            return false;
        }

        // Auto banners need locally downloaded media so hero images actually render.
        return filled($product->mainImage->localUrlFor('pdp') ?: $product->mainImage->localUrlFor('card'));
    }

    private static function attribute(Collection $attributes, array $names): ?string
    {
        foreach ($names as $name) {
            $value = $attributes->get($name);
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private static function hasAttribute(Collection $attributes, array $names): bool
    {
        return self::attribute($attributes, $names) !== null;
    }

    private static function moneyAttribute(Collection $attributes, array $names): ?float
    {
        $value = self::attribute($attributes, $names);
        if ($value === null) {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }

        $digits = preg_replace('/[^\d]/', '', $value);

        return filled($digits) ? (float) $digits : null;
    }

    private static function booleanAttribute(Collection $attributes, array $names, bool $default): bool
    {
        $value = self::attribute($attributes, $names);
        if ($value === null) {
            return $default;
        }

        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        return $parsed ?? $default;
    }
}
