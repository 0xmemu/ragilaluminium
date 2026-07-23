<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

/**
 * Opaque product public-ID helpers (DB columns parent_sku / variant_sku):
 * - Shopee import: SP{product_id}, variants SP{id}-{variation_id}
 * - Website/admin create: random opaque ID with configurable prefix (default WEB)
 *
 * These codes are URL/backend keys — do not display them on the storefront.
 */
class ShopeeStyleSku
{
    public const SHOPEE_PREFIX = 'SP';

    /** Characters for random website IDs (URL-safe, no ambiguous 0/O/1/l). */
    public const RANDOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    public static function manualPrefix(): string
    {
        return (string) config('storefront.manual_sku_prefix', 'WEB');
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

    /** Allocate a unique opaque public ID for admin-created (website) products. */
    public static function nextParentSku(): string
    {
        $prefix = self::manualPrefix();

        return DB::transaction(function () use ($prefix) {
            Product::query()
                ->where('parent_sku', 'like', $prefix.'%')
                ->lockForUpdate()
                ->pluck('parent_sku');

            for ($attempt = 0; $attempt < 32; $attempt++) {
                $candidate = $prefix.self::randomToken(10);
                if (! Product::where('parent_sku', $candidate)->exists()) {
                    return $candidate;
                }
            }

            throw new \RuntimeException('Unable to allocate a unique product public ID.');
        });
    }

    /** Allocate a unique variant ID for a product (first = parent ID, next = parent-random). */
    public static function nextVariantSku(Product $product): string
    {
        $parentSku = $product->parent_sku;

        return DB::transaction(function () use ($product, $parentSku) {
            ProductVariant::query()
                ->where('product_id', $product->id)
                ->lockForUpdate()
                ->pluck('variant_sku');

            $existing = ProductVariant::query()
                ->where('product_id', $product->id)
                ->pluck('variant_sku');

            if ($existing->isEmpty()) {
                $candidate = $parentSku;
                if (! ProductVariant::where('variant_sku', $candidate)->exists()) {
                    return $candidate;
                }
            }

            for ($attempt = 0; $attempt < 32; $attempt++) {
                $candidate = $parentSku.'-'.self::randomToken(6);
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
