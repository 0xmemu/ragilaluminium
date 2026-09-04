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
        'JENDELA' => 'Jendela',
        'PINTU' => 'Pintu',
        'BOVEN' => 'Boven',
        // Alias lama (English) tetap didukung supaya data/link lama tidak patah.
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
        if ($code === null || $code === "" || $code === "ALL") {
            return "Semua Produk";
        }

        $key = strtoupper(trim((string) $code));
        if (isset(self::CATEGORY[$key])) {
            return self::CATEGORY[$key];
        }

        return self::categoryNameForProductCode($key) ?? ((string) $code);
    }

    /** @return list<string> kode kategori valid (untuk dropdown template import) */
    public static function categoryCodes(): array
    {
        return array_keys(self::CATEGORY);
    }

    /**
     * Nama kategori aktif yang kode produknya (products.product_category) sama dengan
     * kode yang dicari. Kategori baru (bukan legacy) memakai kodenya sendiri sebagai
     * product_category sehingga cukup dicocokkan ke code category.
     */
    private static function categoryNameForProductCode(string $productCode): ?string
    {
        return \Illuminate\Support\Facades\Cache::remember(
            "catalog.category.label.".strtolower($productCode),
            3600,
            function () use ($productCode): ?string {
                return \App\Models\Category::query()
                    ->where("is_active", true)
                    ->get(["code", "name"])
                    ->first(
                        fn (\App\Models\Category $c) => \App\Support\CategoryUrl::codeToProductCode((string) $c->code) === $productCode
                    )?->name;
            }
        );
    }

    /** Kode kategori + alias legacy (data lama masih WINDOW/DOOR/BOUVEN). */
    public static function categoryCodesWithLegacy(string $code): array
    {
        $code = strtoupper(trim($code));
        $alias = [
            'JENDELA' => ['WINDOW'],
            'PINTU' => ['DOOR'],
            'BOVEN' => ['BOUVEN'],
        ][$code] ?? [];

        return array_values(array_unique(array_merge([$code], $alias)));
    }

    public static function normalizeCategory(?string $code): ?string
    {
        if ($code === null || $code === '' || $code === 'ALL' || $code === 'all') {
            return null;
        }

        $key = strtoupper(trim((string) $code));

        // Satu kanonik Indonesia: JENDELA/PINTU/BOVEN; alias English (WINDOW/
        // DOOR/BOUVEN + WINDOWS/DOORS) tetap dipetakan agar query lama jalan.
        $aliases = [
            'JENDELA' => 'JENDELA',
            'WINDOWS' => 'JENDELA',
            'WINDOW' => 'JENDELA',
            'PINTU' => 'PINTU',
            'DOORS' => 'PINTU',
            'DOOR' => 'PINTU',
            'BOVEN' => 'BOVEN',
            'BOUVEN' => 'BOVEN',
        ];
        if (isset($aliases[$key])) {
            return $aliases[$key];
        }

        // Kode kategori dinamis dari tabel `categories` (bukan daftar tetap).
        $resolved = \App\Support\CategoryUrl::codeToProductCode($key);
        if (isset(self::CATEGORY[$resolved])) {
            return $resolved;
        }

        return \App\Models\Category::query()->where('code', $key)->exists() ? $resolved : null;
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
     * Suffix desain untuk label garis produk. POLOS ikut disebut agar kartu
     * produk tidak ambigu di halaman model yang campur beberapa desain
     * (owner 2026-09-04: "Boven Jungkit Polos" jangan tampil "Boven Jungkit").
     */
    public static function designSuffix(?string $code): string
    {
        $key = self::normalizeDesign($code);
        if ($key === null) {
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
        $db = \Illuminate\Support\Facades\Cache::remember('catalog.model_codes', 3600, function (): array {
            return \App\Models\SubModel::query()
                ->where('is_active', true)
                ->distinct()
                ->pluck('product_model')
                ->filter()
                ->map(fn ($m) => strtoupper((string) $m))
                ->values()
                ->all();
        });

        return array_values(array_unique(array_merge(self::MODEL_ORDER, $db)));
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

    public static function titleCaseIndonesia(string $raw): string
    {
        return str_replace('_', ' ', ucwords(strtolower($raw)));
    }
}
