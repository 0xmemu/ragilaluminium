<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * Storefront / API product text search (name, SKU, model, category, attributes,
 * dimensi, warna) — deterministik, explainable, tanpa AI.
 *
 * Pipeline: trim → escape wildcard LIKE → normalisasi (typo + sinonim, whole-word,
 * case-insensitive; query asli tetap tersedia via normalizeQuery) → tokenisasi →
 * resolusi taxonomy (kategori/model/desain) → parser dimensi (ukuran identik,
 * pasangan terbalik disengaja, dan RANGE dengan orientasi dipertahankan) →
 * warna resmi hanya dari product_variants → substring LIKE terkendali.
 *
 * Prinsip (§6, lihat docs/features/01-search.md):
 *  - Query asli tidak pernah dihancurkan diam-diam: original vs normalized selalu
 *    dipertahankan (debrief/telemetri pakai original).
 *  - Sinonim deterministik: bouven→boven; typo deterministik whole-word: slidding→sliding.
 *  - Kata ambigu (minimalis/modern/elegan/mewah) tidak pernah memicu "match samar";
 *    diarahkan ke kategori/model/desain/warna/ukuran yang BENAR-BENAR ada di DB.
 *  - Warna hanya dari nilai varian resmi (product_variants variation option),
 *    tidak pernah menginventaris; ejaan diselaraskan ke nilai resmi bila ada.
 *  - Dimensi: ukuran identik, pasangan terbalik yang SAMA disengaja, dan range wajar
 *    dengan orientasi dipertahankan ("Tinggi × Panjang"); tidak memaksa rekomendasi
 *    ukuran terbalik; ukuran terdekat ditawarkan lewat nearestSizeVariants().
 */
class CatalogSearch
{
    /**
     * Typo deterministik whole-word (case-insensitive). Kunci selalu lowercase;
     * nilai = kata kanonik yang benar-benar ada di katalog. Jaga daftar kecil &
     * tidak ambigu agar tidak "mengerasi" kata yang sah.
     *
     * @var array<string, string>
     */
    private const TYPO_MAP = [
        'slidding' => 'sliding',
        'slidng' => 'sliding',
        'slidingg' => 'sliding',
        'jenndela' => 'jendela',
    ];

    /**
     * Sinonim Bahasa Indonesia → istilah kanonik katalog (whole-word, lowercase).
     * bouven adalah sinonim boven; geser=sliding; ayun=swing (pintu ayun).
     *
     * @var array<string, string>
     */
    private const SYNONYM_MAP = [
        'bouven' => 'boven',
        'geser' => 'sliding',
        'ayun' => 'swing',
    ];

    /**
     * @var array<string, string> TYPO_MAP ∪ SYNONYM_MAP.
     */
    private const NORMALIZATION_MAP = self::TYPO_MAP + self::SYNONYM_MAP;

    /**
     * Kata deskriptor yang terlalu samar untuk men-klaim intent katalog. Tidak
     * pernah dipakai sebagai token taxonomy/warna; substring global tetap berlaku
     * sehingga produk yang MEMANG bernama "Minimalis" tetap ketemu, tanpa
     * memicu match samar untuk kata yang tidak ada di katalog.
     *
     * @var list<string>
     */
    private const AMBIGUOUS_DESCRIPTORS = [
        'minimalis', 'modern', 'elegan', 'mewah', 'premium', 'eksklusif', 'klasik',
        'unik', 'keren', 'bagus', 'cantik', 'simpel', 'simple', 'hemat', 'murah',
        'mahal', 'terbaik', 'best',
    ];

    /**
     * Kata fungsi yang tidak membawa intent katalog (ditepis dari resolusi token).
     *
     * @var list<string>
     */
    private const STOPWORDS = [
        'x', '×', 'cm', 'dan', 'atau', 'yang', 'untuk', 'dengan', 'ukuran',
        'pada', 'di', 'ke', 'dari', 'ini', 'itu', 'serta',
    ];

    /**
     * Ejaan varian → nilai warna RESMI di DB (hanya jika nilai resmi itu ada).
     * Perbaikan deterministik ejaan umum; tidak menambah warna baru.
     *
     * @var array<string, string>
     */
    private const COLOR_SPELLING_ALIASES = [
        'coklat' => 'cokelat',
        'serat akayu' => 'serat kayu',
    ];

    /**
     * Apply free-text search so phrases like "jendela sliding" hit taxonomy + titles.
     *
     * @param  Builder<\App\Models\Product>  $query
     * @return Builder<\App\Models\Product>
     */
    public static function apply(Builder $query, string $term): Builder
    {
        $original = trim($term);
        if ($original === '') {
            return $query;
        }

        // §6 boundary: input user bukan pola LIKE. Wildcard `%`, `_`, `\` di-escape
        // agar diperlakukan literal — `?q=%` tidak lagi cocok dengan seluruh katalog.
        // Panjang dibatasi supaya query tidak membengkak dengan pola raksasa.
        $escaped = mb_substr(self::escapeLikeWildcards($original), 0, 120);

        // Normalisasi deterministik (typo + sinonim). Query asli tetap disimpan &
        // dikembalikan lewat normalizeQuery(); hanya salinan `normalized` yang
        // dipakai untuk mencocokkan agar hasil tidak terlihat merusak input.
        $term = self::normalizeQuery($escaped)['normalized'];

        $tokens = preg_split('/\s+/u', mb_strtolower($term), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $modelCodes = self::modelCodesMatching($term, $tokens);
        $categoryCodes = self::categoryCodesMatching($term, $tokens);
        $designCodes = self::designCodesMatching($term, $tokens);
        $colorOptions = self::colorOptionsMatching($tokens);
        $hasTaxonomyCombo = $modelCodes !== [] && $categoryCodes !== [];

        // Pola ukuran: "100x50" / "100 x 50" / "100×50" — termasuk pasangan
        // terbalik (50x100) supaya pencarian dimensi menemukan produk yang
        // namanya ditulis "Tinggi 100 x Panjang 50 cm" (§6 deliberate).
        $sizePatterns = self::sizeLikePatterns($term);
        $dimensionPairs = self::dimensionPairs($term);

        // Range dimensi: "80x100 sampai 85x110" — orientasi dipertahankan.
        // Saat range terdeteksi, pola ukuran tunggal & pasangan dinonaktifkan;
        // hanya pencocokan rentang (product_variants height/width) yang dipakai,
        // supaya tidak membalik orientasi atau melewatkan ukuran tengah range.
        $dimensionRange = self::dimensionRange($term);
        if ($dimensionRange !== null) {
            $sizePatterns = [];
            $dimensionPairs = [];
        }

        // Term ukuran murni ("100x50") TIDAK boleh memakai pola literal `%term%`
        // karena memicu digit-substring: "%50x100%" cocok dengan suffix
        // "(150x100)". Untuk size/range term, hanya pola terjangkarkan yang dipakai.
        $isSizeTerm = preg_match('/^\d+\s*[x×]\s*\d+$/iu', trim($term)) === 1;
        $isRangeTerm = $dimensionRange !== null;

        $query->where(function ($inner) use ($term, $sizePatterns, $dimensionPairs, $dimensionRange, $modelCodes, $categoryCodes, $designCodes, $colorOptions, $hasTaxonomyCombo, $isSizeTerm, $isRangeTerm) {
            // LIKE selalu pakai ESCAPE eksplisit: tanpa itu, backslash-escape (`\%`)
            // hanya default di MySQL — SQLite/PostgreSQL memperlakukan `\` sebagai
            // karakter literal sehingga pola yang sudah di-escape jadi salah.
            if (! $isSizeTerm && ! $isRangeTerm) {
                self::likeClause($inner, 'name', '%'.$term.'%');
                self::likeClause($inner, 'parent_sku', '%'.$term.'%', true);
                self::likeClause($inner, 'short_name', '%'.$term.'%', true);
            }
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

            $inner->orWhereHas('attributes', function ($qa) use ($term, $sizePatterns, $isSizeTerm) {
                $qa->where(function ($attr) use ($term, $sizePatterns, $isSizeTerm) {
                    if (! $isSizeTerm) {
                        self::likeClause($attr, 'attribute_value', '%'.$term.'%');
                    }
                    foreach ($sizePatterns as $pattern) {
                        self::likeClause($attr, 'attribute_value', $pattern, true);
                    }
                });
            });

            $inner->orWhereHas('activeVariants', function ($vq) use ($term, $sizePatterns, $dimensionPairs, $dimensionRange) {
                $vq->where(function ($variant) use ($term, $sizePatterns, $dimensionPairs, $dimensionRange) {
                    $patterns = $sizePatterns !== [] ? $sizePatterns : ['%'.$term.'%'];
                    foreach ($patterns as $pattern) {
                        self::likeClause($variant, 'variant_sku', $pattern, true);
                        self::likeClause($variant, 'variation_1_option', $pattern, true);
                        self::likeClause($variant, 'variation_2_option', $pattern, true);
                    }

                    foreach ($dimensionPairs as [$height, $width]) {
                        $variant->orWhere(function ($dimensions) use ($height, $width) {
                            $dimensions->where('height_cm', $height)->where('width_cm', $width);
                        });
                    }

                    // Range dimensi: product_variants.height_cm/width_cm dalam
                    // rentang dengan orientasi dipertahankan (height pertama).
                    if ($dimensionRange !== null) {
                        $variant->orWhere(function ($range) use ($dimensionRange) {
                            $range->whereBetween('height_cm', [$dimensionRange['hMin'], $dimensionRange['hMax']])
                                ->whereBetween('width_cm', [$dimensionRange['wMin'], $dimensionRange['wMax']]);
                        });
                    }
                });
            });

            // Warna resmi dari DB: hanya nilai official color (variation option
            // yang berlabel "Warna") yang dipakai — tidak pernah menginventaris.
            if ($colorOptions !== []) {
                $inner->orWhereHas('activeVariants', function ($cv) use ($colorOptions) {
                    $cv->where(function ($color) use ($colorOptions) {
                        foreach ($colorOptions as $index => $value) {
                            $method = $index === 0 ? 'whereRaw' : 'orWhereRaw';
                            $color->{$method}('LOWER(TRIM(variation_1_option)) = ?', [mb_strtolower(trim($value))]);
                        }
                    });
                });
            }



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

        // Desain resmi (design_variant) AND dengan SELURUH hasil group OR —
        // diletakkan DI LUAR group agar tidak ikut ter-OR (Laravel boolean
        // chain pada nested group). "seri a" / "ornamen" diarahkan ke desain
        // yang benar-benar tersedia, bukan match samar.
        if ($designCodes !== []) {
            $query->whereIn('design_variant', $designCodes);
        }

        return $query;
    }

    /**
     * Normalisasi deterministik query: whole-word, case-insensitive, terapkan
     * kamus typo + sinonim. Query asli SELALU dipertahankan & dikembalikan agar
     * telemetri/debrief memakai input asli, bukan hasil yang sudah diubah.
     *
     * @return array{
     *     original: string,
     *     normalized: string,
     *     changed: bool,
     *     replacements: list<string>,
     * }
     */
    public static function normalizeQuery(string $term): array
    {
        $replacements = [];
        $normalized = preg_replace_callback('/[^\s]+/u', function (array $match) use (&$replacements): string {
            $lower = mb_strtolower($match[0]);
            $canonical = self::NORMALIZATION_MAP[$lower] ?? null;
            if ($canonical === null || $canonical === $lower) {
                return $match[0];
            }
            $replacements[] = $lower.' → '.$canonical;

            return $canonical;
        }, $term) ?? $term;

        return [
            'original' => $term,
            'normalized' => $normalized,
            'changed' => mb_strtolower($normalized) !== mb_strtolower($term),
            'replacements' => array_values(array_unique($replacements)),
        ];
    }

    /**
     * Nilai warna RESMI yang tersedia di DB: variation option aktif yang berlabel
     * "Warna" (variation_*_name), di kedua sumbu bila ada. Tidak pernah meng-invent
     * warna — sumber kebenaran = product_variants.
     *
     * @return list<string>
     */
    public static function officialColorValues(): array
    {
        $values = [];
        foreach (['variation_1_option', 'variation_2_option'] as $optionColumn) {
            $nameColumn = str_replace('_option', '_name', $optionColumn);
            foreach (ProductVariant::query()
                ->where('status', 'active')
                ->whereNotNull($optionColumn)
                ->whereRaw('LOWER(TRIM('.$nameColumn.')) = ?', ['warna'])
                ->distinct()
                ->pluck($optionColumn) as $value) {
                $values[] = trim((string) $value);
            }
        }

        return array_values(array_unique(array_filter($values)));
    }

    /**
     * Resolve warna dari token query ke nilai resmi DB (official colors).
     * Pencocokan: nilai persis, alias ejaan deterministik (coklat→cokelat), atau
     * awalan/akhiran kata yang unik terhadap SATU warna resmi. Warna yang tidak
     * ada di DB tidak pernah dikembalikan.
     *
     * @param  list<string>  $tokens
     * @return list<string>  nilai warna resmi (case asli DB)
     */
    protected static function colorOptionsMatching(array $tokens): array
    {
        $byKey = [];
        foreach (self::officialColorValues() as $value) {
            $byKey[self::normalizeColorToken($value)] = $value;
        }

        $found = [];
        foreach ($tokens as $piece) {
            if (self::isIgnorableToken($piece)) {
                continue;
            }

            $key = self::normalizeColorToken($piece);
            if (isset($byKey[$key])) {
                $found[] = $byKey[$key];
                continue;
            }

            // Alias ejaan deterministik → nilai resmi (jika resmi itu ada).
            $canonical = self::COLOR_SPELLING_ALIASES[$key] ?? null;
            if ($canonical !== null && isset($byKey[$canonical])) {
                $found[] = $byKey[$canonical];
                continue;
            }

            // Awalan/akhiran kata unik terhadap SATU warna (mis. "serat" → hanya
            // mengarah ke "Serat Kayu" bila tepat satu warna yang cocok). Jika
            // ambigu (≥2 kemungkinan), jangan tebak → hindari match yang menyesatkan.
            $prefixOrSuffixMatches = [];
            foreach (array_keys($byKey) as $candidate) {
                if (mb_strlen($key) < 3) {
                    continue;
                }
                if (str_starts_with($candidate, $key) || str_ends_with($candidate, ' '.$key)) {
                    $prefixOrSuffixMatches[] = $candidate;
                }
            }
            if (count($prefixOrSuffixMatches) === 1) {
                $found[] = $byKey[$prefixOrSuffixMatches[0]];
            }
        }

        return array_values(array_unique($found));
    }

    private static function normalizeColorToken(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value));
    }

    /**
     * @param  list<string>  $tokens
     * @return list<string>
     */
    protected static function designCodesMatching(string $term, array $tokens): array
    {
        $found = [];

        // Frase "seri a / seri b / seri c" (atau "series a") → SERIES_A/B/C.
        if (preg_match('/\bseri(?:s)?\s+([abc])\b/iu', $term, $m) === 1) {
            $found[] = 'SERIES_'.strtoupper($m[1]);
        }

        // Label/kode desain dinamis dari DB (sub_models aktif) + DESIGN_ORDER.
        $labelToCode = [];
        foreach (CatalogLabels::designCodes() as $code) {
            $labelToCode[mb_strtolower($code)] = $code;
            $label = mb_strtolower(CatalogLabels::design($code));
            if ($label !== '') {
                // Kode dinamis bisa multi-kata ("Seri A"); token tunggal hanya
                // cocok ke label satu-kata (polos/ornamen/kombinasi).
                if (str_contains($label, ' ')) {
                    $labelToCode[str_replace(' ', '_', $label)] = $code;
                } else {
                    $labelToCode[$label] = $code;
                }
            }
        }

        foreach ($tokens as $piece) {
            if (self::isIgnorableToken($piece)) {
                continue;
            }
            if (isset($labelToCode[$piece])) {
                $found[] = $labelToCode[$piece];
            }
        }

        return array_values(array_unique($found));
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
                if (self::ignorableTaxonomyToken($piece)) {
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
        // Peta kategori DINAMIS dari tabel `categories` + alias legacy back-compat.
        $map = [
            'WINDOW' => ['window', 'windows'],
            'DOOR' => ['door', 'doors'],
            'BOUVEN' => ['bouven', 'boven'],
        ];
        foreach (CategoryUrl::categoryLinks() as $link) {
            $code = (string) $link['code'];
            $map[$code] = array_values(array_unique(array_merge(
                $map[$code] ?? [],
                [mb_strtolower((string) $link['slug']), mb_strtolower((string) $link['label'])]
            )));
        }

        $haystacks = array_values(array_unique(array_merge([mb_strtolower($term)], $tokens)));
        $matched = [];

        foreach ($map as $code => $aliases) {
            foreach ($haystacks as $piece) {
                if (self::ignorableTaxonomyToken($piece)) {
                    continue;
                }
                if (in_array($piece, $aliases, true)) {
                    $matched[] = $code;
                    break;
                }
            }
        }

        return array_values(array_unique($matched));
    }

    /**
     * Token yang TIDAK boleh dipakai untuk me-resolve taxonomy (model/kategori/
     * desain/warna): kosong, ≤2 karakter, stopword, deskriptor ambigu, atau angka.
     * (Panjang 1-2 char seperti "a" di "seri a" memicu substring-containment palsu
     * ke semua model/desain — itulah "match samar" yang harus dihindari.)
     */
    protected static function ignorableTaxonomyToken(string $piece): bool
    {
        $lower = mb_strtolower($piece);

        return $lower === ''
            || mb_strlen($lower) < 3
            || in_array($lower, self::STOPWORDS, true)
            || in_array($lower, self::AMBIGUOUS_DESCRIPTORS, true)
            || preg_match('/\d/u', $lower) === 1;
    }

    protected static function isIgnorableToken(string $piece): bool
    {
        return self::ignorableTaxonomyToken($piece);
    }

    /**
     * @return list<array{0: float, 1: float}>
     */
    protected static function dimensionPairs(string $term): array
    {
        if (! preg_match('/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/iu', trim($term), $matches)) {
            return [];
        }

        $height = (float) $matches[1];
        $width = (float) $matches[2];
        $pairs = [[$height, $width]];

        if ($height !== $width) {
            // Pasangan terbalik yang SAMA disengaja (§6 deliberate): query "100x50"
            // tetap menemukan produk yang memang ada dengan orientasi "50x100".
            $pairs[] = [$width, $height];
        }

        return $pairs;
    }

    /**
     * Parse ukuran eksak pertama dari query: "100x50" → height=100, width=50.
     * Default (dan satu-satunya) konvensi orientasi = "Tinggi × Panjang".
     *
     * @return array{height: float, width: float}|null
     */
    public static function exactDimension(string $term): ?array
    {
        if (preg_match('/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/iu', trim($term), $m) === 1) {
            return [
                'height' => (float) $m[1],
                'width' => (float) $m[2],
            ];
        }

        return null;
    }

    /**
     * Parse RANGE dimensi: "80x100 sampai 85x110", "80x100 hingga 85x110",
     * "80x100 - 85x110", "80x100 s/d 85x110". Orientasi selalu dipertahankan
     * (angka pertama = Tinggi, kedua = Panjang); min/max dinormalkan per sumbu.
     *
     * @return array{hMin: float, wMin: float, hMax: float, wMax: float}|null
     */
    public static function dimensionRange(string $term): ?array
    {
        $pattern = '/(\d+(?:\.\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm)?'
            .'\s*(?:sampai|hingga|s\/d|sd|s\.d|-|–|—|sampai dengan|to)\s*'
            .'(\d+(?:\.\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm)?/iu';

        if (preg_match($pattern, trim($term), $m) !== 1) {
            return null;
        }

        $hMin = (float) $m[1];
        $wMin = (float) $m[2];
        $hMax = (float) $m[3];
        $wMax = (float) $m[4];

        if ($hMin > $hMax) {
            [$hMin, $hMax] = [$hMax, $hMin];
        }
        if ($wMin > $wMax) {
            [$wMin, $wMax] = [$wMax, $wMin];
        }

        return compact('hMin', 'wMin', 'hMax', 'wMax');
    }

    /**
     * Size queries like "60x120" / "60 x 120" / "60×120" share one match set.
     *
     * Pola lama `%W%x%H%` menghasilkan false positive substring digit:
     * "100x50" ikut mencocokkan "Tinggi 150 cm x Panjang 100 cm" karena
     * "150" mengandung "50". Sekarang pola dijangkarkan pada struktur nama
     * katalog ("Tinggi ... Panjang ..." atau suffix "(W x H)") dan angka
     * dipisah spasi pada bentuk bebas, sehingga ukuran lain tidak tampil.
     * Pasangan terbalik (120x60) tetap dicari oleh desain (§6 deliberate,
     * lihat CatalogSearchBoundaryTest::test_dimension_search_matches_reversed_pair).
     *
     * CATATAN: tidak boleh pakai karakter class LIKE `[^0-9]` — test suite
     * berjalan di SQLite yang tidak mendukungnya (hanya `%` dan `_`).
     *
     * @return list<string>
     */
    protected static function sizeLikePatterns(string $term): array
    {
        $patterns = [];

        if (preg_match('/(\d+)\s*[x×]\s*(\d+)/iu', trim($term), $matches)) {
            $pairs = [[$matches[1], $matches[2]]];
            if ($matches[1] !== $matches[2]) {
                $pairs[] = [$matches[2], $matches[1]];
            }

            foreach ($pairs as [$width, $height]) {
                // Bentuk panjang katalog: "Tinggi 100 cm x Panjang 50 cm"
                // dan varian × tanpa spasi ("Tinggi 100cm × Panjang 50cm").
                $patterns[] = '%Tinggi '.$width.'%x%Panjang '.$height.'%';
                $patterns[] = '%Tinggi '.$width.'%×%Panjang '.$height.'%';
                // Bentuk bebas berjarak: "Jendela Jungkit 50 x 100 cm".
                // Spasi mengapit angka supaya "150" tidak menangkap "50".
                $patterns[] = '% '.$width.' %x% '.$height.' %';
                $patterns[] = '% '.$width.' %×% '.$height.' %';
                // Suffix terstruktur pada nama: "(100x50)", "(100 x 50)",
                // "(100×50)", "(100 × 50)".
                $patterns[] = '%('.$width.'x'.$height.')%';
                $patterns[] = '%('.$width.' x '.$height.')%';
                $patterns[] = '%('.$width.'×'.$height.')%';
                $patterns[] = '%('.$width.' × '.$height.')%';
            }
        }

        return array_values(array_unique($patterns));
    }

    /**
     * Varian aktif terdekat (berdasarkan jarak |ΔTinggi| + |ΔPanjang|) terhadap
     * ukuran target — dipakai sebagai rekomendasi ukuran terdekat yang RELEVAN,
     * tanpa memaksa balik orientasi. Hanya varian produk aktif yang dipertimbangkan.
     *
     * @return list<array{
     *     variant_sku: string,
     *     height_cm: float,
     *     width_cm: float,
     *     price: float,
     *     distance: float,
     * }>
     */
    public static function nearestSizeVariants(float $height, float $width, int $limit = 8): array
    {
        if ($limit < 1) {
            return [];
        }

        $rows = ProductVariant::query()
            ->where('status', 'active')
            ->whereNotNull('height_cm')
            ->whereNotNull('width_cm')
            ->whereHas('product', function ($p) {
                $p->where('status', 'active');
            })
            ->get(['variant_sku', 'height_cm', 'width_cm', 'price', 'product_id']);

        return $rows
            ->map(function ($v) use ($height, $width) {
                $h = (float) $v->height_cm;
                $w = (float) $v->width_cm;

                return [
                    'variant_sku' => (string) $v->variant_sku,
                    'height_cm' => $h,
                    'width_cm' => $w,
                    'price' => (float) $v->price,
                    'distance' => abs($h - $height) + abs($w - $width),
                ];
            })
            ->sortBy('distance')
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * Kata kunci katalog yang BENAR-BENAR tersedia (dari DB): model, desain,
     * kategori, warna resmi. Dipakai untuk saran "Mungkin yang Anda maksud"
     * (mirroring docs/features/01-search.md) tanpa hardcode katalog.
     *
     * @return list<string>
     */
    public static function catalogKeywordSuggestions(int $limit = 10): array
    {
        $words = [];

        foreach (Product::query()->where('status', 'active')->distinct()->pluck('product_model') as $model) {
            $label = CatalogLabels::model((string) $model);
            if ($label !== '') {
                $words[] = mb_strtolower($label);
            }
        }

        foreach (Product::query()->where('status', 'active')->distinct()->pluck('design_variant') as $design) {
            $label = CatalogLabels::design((string) $design);
            if ($label !== '') {
                $words[] = mb_strtolower($label);
            }
        }

        foreach (CategoryUrl::categoryLinks() as $link) {
            $words[] = mb_strtolower((string) $link['label']);
        }

        foreach (self::officialColorValues() as $color) {
            $words[] = mb_strtolower($color);
        }

        $words = array_values(array_unique(array_filter(array_map('trim', $words))));

        return array_slice($words, 0, $limit);
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
     * WHERE col LIKE ? ESCAPE '\' — portabel lintas driver (MySQL/SQLite/PgSQL).
     * Kolom hardcoded (bukan input user); pattern sebagai binding → aman injection.
     */
    protected static function likeClause(Builder $query, string $column, string $pattern, bool $or = false): void
    {
        $query->{$or ? 'orWhereRaw' : 'whereRaw'}("{$column} LIKE ? ESCAPE ?", [$pattern, '\\']);
    }
}
