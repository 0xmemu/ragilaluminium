<?php

namespace App\Support;

/**
 * Label tampilan + normalisasi taxonomy katalog.
 * Enum DB sudah berbahasa Indonesia (kecuali Sliding/Swing yang umum dipakai).
 */
class CatalogLabels
{
    public const MODEL_ORDER = ['JUNGKIT', 'SLIDING', 'SWING', 'KACA_MATI', 'ZIGZAG'];

    public const DESIGN_ORDER = ['POLOS', 'ORNAMEN', 'KOMBINASI', 'SERIES_A', 'SERIES_B', 'SERIES_C'];

    /** @var array<string, string> Alias query lama → enum baru */
    private const MODEL_ALIASES = [
        'FIXED' => 'KACA_MATI',
        'KACA-MATI' => 'KACA_MATI',
        'KACAMATI' => 'KACA_MATI',
    ];

    /** @var array<string, string> */
    private const DESIGN_ALIASES = [
        'PLAIN' => 'POLOS',
        'ORNAMENT' => 'ORNAMEN',
        'COMBINATION' => 'KOMBINASI',
    ];

    /** @var array<string, string> */
    private const CATEGORY = [
        'WINDOW' => 'Jendela',
        'DOOR' => 'Pintu',
        'BOUVEN' => 'Boven',
    ];

    /** @var array<string, string> */
    private const MODEL = [
        'JUNGKIT' => 'Jungkit',
        'SLIDING' => 'Sliding',
        'SWING' => 'Swing',
        'KACA_MATI' => 'Kaca Mati',
        'ZIGZAG' => 'Zigzag',
    ];

    /** @var array<string, string> */
    private const DESIGN = [
        'POLOS' => 'Polos',
        'ORNAMEN' => 'Ornamen',
        'KOMBINASI' => 'Kombinasi',
        'SERIES_A' => 'Seri A',
        'SERIES_B' => 'Seri B',
        'SERIES_C' => 'Seri C',
    ];

    public static function category(?string $code): string
    {
        if ($code === null || $code === '' || $code === 'ALL') {
            return 'Semua Produk';
        }

        return self::CATEGORY[strtoupper($code)] ?? $code;
    }

    public static function normalizeModel(?string $code): ?string
    {
        if ($code === null || $code === '') {
            return null;
        }

        $key = strtoupper(str_replace(' ', '_', $code));
        $key = self::MODEL_ALIASES[$key] ?? $key;

        return $key;
    }

    public static function normalizeDesign(?string $code): ?string
    {
        if ($code === null || $code === '') {
            return null;
        }

        $key = strtoupper($code);
        $key = self::DESIGN_ALIASES[$key] ?? $key;

        return $key;
    }

    public static function model(?string $code): string
    {
        $key = self::normalizeModel($code);
        if ($key === null) {
            return '';
        }

        return self::MODEL[$key] ?? self::titleCaseIndonesia($key);
    }

    public static function design(?string $code): string
    {
        $key = self::normalizeDesign($code);
        if ($key === null) {
            return '';
        }

        $map = self::designLabelMap();

        return $map[$key] ?? self::DESIGN[$key] ?? self::titleCaseIndonesia($key);
    }

    /**
     * Suffix desain untuk label garis produk; POLOS tidak ditambahkan.
     */
    public static function designSuffix(?string $code): string
    {
        $key = self::normalizeDesign($code);
        if ($key === null || $key === 'POLOS') {
            return '';
        }

        return self::design($key);
    }

    /**
     * Contoh: "Jendela Sliding Ornamen", "Boven Kaca Mati", "Pintu Swing".
     */
    public static function productLine(?string $category, ?string $model, ?string $design = null): string
    {
        $parts = array_filter([
            self::category($category),
            self::model($model),
            self::designSuffix($design),
        ], fn ($p) => $p !== '' && $p !== 'Semua Produk');

        return implode(' ', $parts);
    }

    public static function modelCardTitle(?string $category, ?string $model): string
    {
        $cat = self::category($category);
        $modelLabel = self::model($model);

        if ($cat === 'Semua Produk') {
            return 'Aluminium '.$modelLabel;
        }

        return $cat.' Aluminium '.$modelLabel;
    }

    /** @return list<string> */
    public static function modelCodes(): array
    {
        return self::MODEL_ORDER;
    }

    /** @return list<string> */
    public static function designCodes(?string $productModel = null): array
    {
        $codes = \Illuminate\Support\Facades\Cache::remember(
            'catalog.sub_model_codes.'.($productModel ?? 'all'),
            3600,
            function () use ($productModel): array {
                $query = \App\Models\SubModel::query()->where('is_active', true);
                if ($productModel !== null) {
                    $query->where('product_model', $productModel);
                }

                return $query->orderBy('sort_order')->orderBy('id')->pluck('code')->all();
            }
        );

        return array_values(array_unique(array_merge($codes, self::DESIGN_ORDER)));
    }

    /** @return array<string, string> Kode sub model aktif -> label */
    private static function designLabelMap(): array
    {
        return \Illuminate\Support\Facades\Cache::remember('catalog.sub_model_labels', 3600, function (): array {
            return \App\Models\SubModel::query()
                ->where('is_active', true)
                ->get(['code', 'name'])
                ->pluck('name', 'code')
                ->map(fn (string $name) => (string) $name)
                ->all();
        });
    }

    private static function titleCaseIndonesia(string $raw): string
    {
        return str_replace('_', ' ', ucwords(strtolower($raw)));
    }
}
