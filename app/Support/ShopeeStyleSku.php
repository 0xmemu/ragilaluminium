<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

/**
 * Opaque public IDs for products & variants (columns parent_sku / variant_sku):
 *
 * - Shopee import (legacy, immutable): SP{product_id}, variants SP{id}-{variation_id}
 * - Admin / website create (Fase 4, FINAL): RA + 10 random chars (products),
 *   RA + 6..8 random chars (variants), NO dashes, fully opaque and unique.
 *   Variant -> product association is via FK product_variant.product_id, NEVER
 *   by parsing the variant SKU.
 *
 * These codes are URL/backend keys - do not display them on the storefront.
 */
class ShopeeStyleSku
{
    public const SHOPEE_PREFIX = 'SP';

    /** FINAL website/admin prefix (Fase 4): RA + random, no dashes. */
    public const WEBSITE_PREFIX = 'RA';

    /** Characters for random website IDs (URL-safe, no ambiguous 0/O/1/l). */
    public const RANDOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    /** Random token length for admin-created products (RA + 10). */
    public const PARENT_RANDOM_LENGTH = 10;

    /** Random token length range for admin-created variants (RA + 6..8). */
    public const VARIANT_RANDOM_MIN = 6;
    public const VARIANT_RANDOM_MAX = 8;

    public static function manualPrefix(): string
    {
        return (string) config('storefront.manual_sku_prefix', self::WEBSITE_PREFIX);
    }

    public static function formatParentSku(string|int $productId): string
    {
        return self::SHOPEE_PREFIX.(string) $productId;
    }

    public static function formatManualParentSku(string|int $productId): string
    {
        return self::manualPrefix().(string) $productId;
    }

    public static function formatVariantSku(
        string $parentSku,
        ?string $variationId = null,
        ?string $explicitVariantSku = null,
    ): string {
        if ($explicitVariantSku !== null && $explicitVariantSku !== '') {
            return $explicitVariantSku;
        }

        if ($variationId !== null && $variationId !== '') {
            return $parentSku.'-'.$variationId;
        }

        return $parentSku;
    }

    /**
     * Allocate a unique opaque product public ID for admin-created (website)
     * products: RA + 10 random chars. Generated only on create/duplicate and
     * IMMUTABLE afterwards - editing attributes never changes the SKU.
     */
    public static function nextParentSku(): string
    {
        return DB::transaction(function () {
            for ($attempt = 0; $attempt < 32; $attempt++) {
                $candidate = self::WEBSITE_PREFIX.self::randomToken(self::PARENT_RANDOM_LENGTH);
                if (! Product::where('parent_sku', $candidate)->exists()) {
                    return $candidate;
                }
            }

            throw new \RuntimeException('Unable to allocate a unique product public ID.');
        });
    }

    /**
     * Allocate a unique opaque variant public ID: RA + 6..8 random chars,
     * fully independent from the parent SKU (no dashes). Association to the
     * product relies on the product_id FK, never on SKU parsing.
     */
    public static function nextVariantSku(Product $product): string
    {
        $length = random_int(self::VARIANT_RANDOM_MIN, self::VARIANT_RANDOM_MAX);

        return DB::transaction(function () use ($product, $length) {
            for ($attempt = 0; $attempt < 32; $attempt++) {
                $candidate = self::WEBSITE_PREFIX.self::randomToken($length);
                if (! ProductVariant::where('variant_sku', $candidate)->exists()) {
                    return $candidate;
                }
            }

            throw new \RuntimeException('Unable to allocate a unique variant public ID.');
        });
    }

    public static function parseShopeeParentNumericSuffix(string $sku): ?int
    {
        if (! preg_match('/^'.self::SHOPEE_PREFIX.'(\d+)$/', $sku, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }

    public static function parseManualParentNumericSuffix(string $sku): ?int
    {
        $prefix = preg_quote(self::manualPrefix(), '/');
        if (! preg_match('/^'.$prefix.'(\d+)$/', $sku, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }

    protected static function randomToken(int $length): string
    {
        $alphabet = self::RANDOM_ALPHABET;
        $max = strlen($alphabet) - 1;
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $alphabet[random_int(0, $max)];
        }

        return $out;
    }
}
