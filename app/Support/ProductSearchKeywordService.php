<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductVariant;

/**
 * Generator short_name + search_keywords (Fase 3 import-katalog-indonesia).
 *
 * Lapis 1: short_name dari varian aktif pertama yang punya dimensi ({tinggi}x{panjang}).
 * Lapis 2: parse nama untuk dimensi & token kata bebas (stopword minimal).
 * Lapis 3: fallback - tanpa dimensi, short_name dibiarkan null, keywords tetap terisi.
 * search_keywords SELALU ditimpa; short_name hanya diisi bila masih kosong
 * (nilai manual admin tidak pernah ditimpa).
 */
class ProductSearchKeywordService
{
    private const STOPWORDS = ['tinggi', 'panjang', 'cm', 'mm', 'x', 'pintu', 'jendela', 'boven'];

    public function generate(Product $product): void
    {
        $keywords = [];

        // Lapis 1: short_name dari varian aktif berdimensi
        $dimVariant = $product->variants
            ->where('status', 'active')
            ->first(fn (ProductVariant $v) => $v->height_cm && $v->width_cm);
        $short = $dimVariant
            ? $this->formatDim($dimVariant->height_cm).'x'.$this->formatDim($dimVariant->width_cm)
            : null;

        if ($short !== null) {
            $keywords[] = $short;
        }
        if ($product->short_name) {
            $keywords[] = $product->short_name;
        }

        // Label kategori/model/desain
        foreach ([$product->product_category, $product->product_model, $product->design_variant] as $label) {
            if ($label) {
                $keywords[] = strtolower((string) $label);
            }
        }

        // Lapis 2: parse nama - dimensi + token kata
        $name = strtolower((string) $product->name);
        if (preg_match('/(\d+)\s*cm\s*[xX×]\s*(\d+)/', $name, $m)) {
            $keywords[] = $this->formatDim((float) $m[1]).'x'.$this->formatDim((float) $m[2]);
        }

        foreach (preg_split('/[\s,;\/()\-]+/', $name) ?: [] as $token) {
            $token = trim($token);
            if ($token === '' || in_array($token, self::STOPWORDS, true)) {
                continue;
            }
            $keywords[] = $token;
        }

        $keywords = array_values(array_unique(array_filter($keywords)));
        $product->updateQuietly(['search_keywords' => implode(' ', $keywords)]);

        if ($short !== null && empty($product->short_name)) {
            $product->updateQuietly(['short_name' => $short]);
        }
    }

    private function formatDim(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }
}