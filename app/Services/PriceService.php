<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;

/**
 * Sumber tunggal perhitungan harga storefront (ADR-007, SPESIFIKASI-FINAL §B).
 *
 * Bandrol (harga asli) = product_variants.price, diisi admin manual.
 * Harga jual = Bandrol x (1 - diskon efektif), dibulatkan ke atas Rp1.000.
 * Diskon efektif: Flash Sale menggantikan Diskon Produk (Promo Toko) bila keduanya aktif.
 * Atribut legacy promo_compare_price TIDAK dibaca di sini.
 */
final class PriceService
{
    public const ROUNDING_STEP = 1000;

    public function __construct(private readonly CampaignService $campaigns)
    {
    }

    /**
     * @return array{bandrol: float, sale: float, compare: float|null, discount_percent: int, source: string|null, flash_sale: bool}
     */
    public function forVariant(ProductVariant $variant, ?Product $product = null): array
    {
        $bandrol = max(0, (float) $variant->price);
        $coverage = $this->campaigns->forProduct($product ?? $variant->product, $variant);
        $flash = $coverage['flash'];
        $store = $coverage['store'];

        $source = null;
        $percent = 0;
        if ($flash !== null) {
            $source = 'flash_sale';
            $percent = (int) $flash['discount_percent'];
        } elseif ($store !== null) {
            $source = 'store';
            $percent = (int) $store['discount_percent'];
        }

        $sale = $bandrol;
        $compare = null;
        if ($percent > 0) {
            $sale = self::applyDiscount($bandrol, $percent);
            if ($sale < $bandrol) {
                $compare = $bandrol;
            } else {
                // Pembulatan membuat harga tidak turun — jangan tampilkan diskon.
                $sale = $bandrol;
                $percent = 0;
                $source = null;
            }
        }

        return [
            'bandrol' => $bandrol,
            'sale' => $sale,
            'compare' => $compare,
            'discount_percent' => $percent,
            'source' => $source,
            'flash_sale' => $source === 'flash_sale',
        ];
    }

    /**
     * Harga minimum untuk kartu produk (dari semua varian aktif).
     *
     * @return array{min_sale: float|null, min_bandrol: float|null, compare: float|null, discount_percent: int, flash_sale: bool, source: string|null}
     */
    public function productCard(Product $product): array
    {
        $variants = $product->relationLoaded('activeVariants')
            ? $product->getRelation('activeVariants')
            : $product->activeVariants()->get();

        $best = null;
        foreach ($variants as $variant) {
            $priced = $this->forVariant($variant, $product);
            if ($best === null || $priced['sale'] < $best['sale']) {
                $best = $priced;
            }
        }

        if ($best === null) {
            return [
                'min_sale' => null,
                'min_bandrol' => null,
                'compare' => null,
                'discount_percent' => 0,
                'flash_sale' => false,
                'source' => null,
            ];
        }

        return [
            'min_sale' => $best['sale'],
            'min_bandrol' => $best['bandrol'],
            'compare' => $best['compare'],
            'discount_percent' => $best['discount_percent'],
            'flash_sale' => $best['flash_sale'],
            'source' => $best['source'],
        ];
    }

    public static function applyDiscount(float $bandrol, int $percent): float
    {
        $percent = max(0, min(100, $percent));
        $sale = $bandrol * (1 - ($percent / 100));

        return self::roundUp($sale);
    }

    public static function roundUp(float $amount): float
    {
        return ceil($amount / self::ROUNDING_STEP) * self::ROUNDING_STEP;
    }
}
