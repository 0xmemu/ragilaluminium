<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * Storefront / API product text search (name, SKU, model, category, attributes).
 */
class CatalogSearch
{
    /**
     * Apply free-text search so phrases like "jendela sliding" hit taxonomy + titles.
     *
     * @param  Builder<\App\Models\Product>  $query
     * @return Builder<\App\Models\Product>
     */
    public static function apply(Builder $query, string $term): Builder
    {
        $term = trim($term);
        if ($term === '') {
            return $query;
        }

        $tokens = preg_split('/\s+/u', mb_strtolower($term), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $modelCodes = self::modelCodesMatching($term, $tokens);
        $categoryCodes = self::categoryCodesMatching($term, $tokens);
        $hasTaxonomyCombo = $modelCodes !== [] && $categoryCodes !== [];

        return $query->where(function ($inner) use ($term, $modelCodes, $categoryCodes, $hasTaxonomyCombo) {
            $inner->where('name', 'like', "%{$term}%")
                ->orWhere('parent_sku', 'like', "%{$term}%")
                ->orWhere('short_name', 'like', "%{$term}%")
                ->orWhere('product_model', 'like', '%'.strtoupper(str_replace([' ', '-'], '_', $term)).'%')
                ->orWhereHas('attributes', fn ($qa) => $qa->where('attribute_value', 'like', "%{$term}%"))
                ->orWhereHas('activeVariants', function ($vq) use ($term) {
                    $vq->where(function ($variant) use ($term) {
                        foreach (self::sizeLikePatterns($term) as $pattern) {
                            $variant->orWhere('variant_sku', 'like', $pattern)
                                ->orWhere('variation_1_option', 'like', $pattern)
                                ->orWhere('variation_2_option', 'like', $pattern);
                        }
                    });
                });

            if ($hasTaxonomyCombo) {
                // "jendela sliding" → WINDOW + SLIDING (both required).
                $inner->orWhere(function ($combo) use ($modelCodes, $categoryCodes) {
                    $combo->whereIn('product_category', $categoryCodes)
                        ->whereIn('product_model', $modelCodes);
                });
            } else {
                if ($modelCodes !== []) {
                    $inner->orWhereIn('product_model', $modelCodes);
                }
                if ($categoryCodes !== []) {
                    $inner->orWhereIn('product_category', $categoryCodes);
                }
            }
        });
    }

    /**
     * Size queries like "60x120" / "60 x 120" / "60×120" share one match set.
     *
     * @return list<string>
     */
    protected static function sizeLikePatterns(string $term): array
    {
        $patterns = ['%'.$term.'%'];

        if (preg_match('/^(\d+)\s*[x×]\s*(\d+)/iu', trim($term), $matches)) {
            $width = $matches[1];
            $height = $matches[2];
            $patterns[] = '%'.$width.'x'.$height.'%';
            $patterns[] = '%'.$width.' x '.$height.'%';
            $patterns[] = '%'.$width.'×'.$height.'%';
            $patterns[] = '%'.$width.' × '.$height.'%';
        }

        return array_values(array_unique($patterns));
    }

    /**
     * @param  list<string>  $tokens
     * @return list<string>
     */
    protected static function modelCodesMatching(string $term, array $tokens): array
    {
        $haystacks = array_values(array_unique(array_merge([mb_strtolower($term)], $tokens)));
        $matched = [];

        foreach (CatalogLabels::MODEL_ORDER as $code) {
            $label = mb_strtolower(CatalogLabels::model($code));
            $slug = mb_strtolower(str_replace('_', ' ', $code));
            foreach ($haystacks as $piece) {
                if ($piece === '') {
                    continue;
                }
                if ($piece === $label || $piece === $slug || str_contains($slug, $piece) || str_contains($piece, $slug)) {
                    $matched[] = $code;
                    break;
                }
            }
        }

        return array_values(array_unique($matched));
    }

    /**
     * @param  list<string>  $tokens
     * @return list<string>
     */
    protected static function categoryCodesMatching(string $term, array $tokens): array
    {
        $map = [
            'WINDOW' => ['jendela', 'window', 'windows'],
            'DOOR' => ['pintu', 'door', 'doors'],
            'BOUVEN' => ['boven', 'bouven'],
        ];

        $haystacks = array_values(array_unique(array_merge([mb_strtolower($term)], $tokens)));
        $matched = [];

        foreach ($map as $code => $aliases) {
            foreach ($haystacks as $piece) {
                if (in_array($piece, $aliases, true)) {
                    $matched[] = $code;
                    break;
                }
            }
        }

        return array_values(array_unique($matched));
    }
}
