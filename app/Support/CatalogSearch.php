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

        // §6 boundary: input user bukan pola LIKE. Wildcard `%`, `_`, `\` di-escape
        // agar diperlakukan literal — `?q=%` tidak lagi cocok dengan seluruh katalog.
        // Panjang dibatasi supaya query tidak membengkak dengan pola raksasa.
        $term = mb_substr(self::escapeLikeWildcards($term), 0, 120);

        $tokens = preg_split('/\s+/u', mb_strtolower($term), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $modelCodes = self::modelCodesMatching($term, $tokens);
        $categoryCodes = self::categoryCodesMatching($term, $tokens);
        $hasTaxonomyCombo = $modelCodes !== [] && $categoryCodes !== [];

        // Pola ukuran: "100x50" / "100 x 50" / "100×50" — termasuk pasangan
        // terbalik (50x100) supaya pencarian dimensi menemukan produk yang
        // namanya ditulis "Tinggi 100 x Panjang 50 cm".
        $sizePatterns = self::sizeLikePatterns($term);

        return $query->where(function ($inner) use ($term, $sizePatterns, $modelCodes, $categoryCodes, $hasTaxonomyCombo) {
            // LIKE selalu pakai ESCAPE eksplisit: tanpa itu, backslash-escape (`\%`)
            // hanya default di MySQL — SQLite/PostgreSQL memperlakukan `\` sebagai
            // karakter literal sehingga pola yang sudah di-escape jadi salah.
            self::likeClause($inner, 'name', "%{$term}%");
            self::likeClause($inner, 'parent_sku', "%{$term}%", true);
            self::likeClause($inner, 'short_name', "%{$term}%", true);
            self::likeClause(
                $inner,
                'product_model',
                '%'.strtoupper(str_replace([' ', '-'], '_', $term)).'%',
                true
            );

            // Dimensi numerik di nama produk ("Tinggi 100 x Panjang 50 cm").
            if ($sizePatterns !== []) {
                foreach ($sizePatterns as $pattern) {
                    self::likeClause($inner, 'name', $pattern, true);
                    self::likeClause($inner, 'short_name', $pattern, true);
                }
            }

            $inner->orWhereHas('attributes', function ($qa) use ($term, $sizePatterns) {
                $qa->where(function ($attr) use ($term, $sizePatterns) {
                    self::likeClause($attr, 'attribute_value', "%{$term}%");
                    foreach ($sizePatterns as $pattern) {
                        self::likeClause($attr, 'attribute_value', $pattern, true);
                    }
                });
            });

            $inner->orWhereHas('activeVariants', function ($vq) use ($term, $sizePatterns) {
                $vq->where(function ($variant) use ($term, $sizePatterns) {
                    $patterns = $sizePatterns !== [] ? $sizePatterns : ['%'.$term.'%'];
                    foreach ($patterns as $pattern) {
                        self::likeClause($variant, 'variant_sku', $pattern, true);
                        self::likeClause($variant, 'variation_1_option', $pattern, true);
                        self::likeClause($variant, 'variation_2_option', $pattern, true);
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
     * Pasangan terbalik (120x60) ikut dicari, dan pola longgar "%W%x%H%"
     * menangkap penulisan panjang seperti "Tinggi 100 x Panjang 50 cm".
     *
     * @return list<string>
     */
    protected static function sizeLikePatterns(string $term): array
    {
        $patterns = ['%'.$term.'%'];

        if (preg_match('/(\d+)\s*[x×]\s*(\d+)/iu', trim($term), $matches)) {
            $pairs = [[$matches[1], $matches[2]]];
            if ($matches[1] !== $matches[2]) {
                $pairs[] = [$matches[2], $matches[1]];
            }

            foreach ($pairs as [$width, $height]) {
                $patterns[] = '%'.$width.'x'.$height.'%';
                $patterns[] = '%'.$width.' x '.$height.'%';
                $patterns[] = '%'.$width.'×'.$height.'%';
                $patterns[] = '%'.$width.' × '.$height.'%';
                // Angka sama walau ada kata di antaranya ("Tinggi 100 x Panjang 50 cm").
                $patterns[] = '%'.$width.'%x%'.$height.'%';
            }
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

    /**
     * Escape LIKE wildcard dari input user agar diperlakukan sebagai literal.
     *
     * @return string
     */
    protected static function escapeLikeWildcards(string $value): string
    {
        // Satu definisi escape: App\Support\LikeSearch.
        return LikeSearch::escape($value);
    }

    /**
     * WHERE col LIKE ? ESCAPE '\\' — portabel lintas driver (MySQL/SQLite/PgSQL).
     * Kolom hardcoded (bukan input user); pattern sebagai binding → aman injection.
     */
    protected static function likeClause(Builder $query, string $column, string $pattern, bool $or = false): void
    {
        $query->{$or ? 'orWhereRaw' : 'whereRaw'}("{$column} LIKE ? ESCAPE ?", [$pattern, '\\']);
    }
}
