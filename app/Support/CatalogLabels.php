<?php

namespace App\Support;

/**
 * Label tampilan + normalisasi taxonomy katalog.
 * Enum DB sudah berbahasa Indonesia (kecuali Sliding/Swing yang umum dipakai).
 */
class CatalogLabels
{
    /** @var array<string, string> Alias query lama → enum baru */
    private const MODEL_ALIASES = [
        'FIXED' => 'KACA_MATI',
        'KACA-MATI' => 'KACA_MATI',
        'KACAMATI' => 'KACA_MATI',
        'JUNGKIT_1D' => 'JUNGKIT_1_DAUN',
        'JUNGKIT_2D' => 'JUNGKIT_2_DAUN',
        'JUNGKIT_3D' => 'JUNGKIT_3_DAUN',
        'SLIDING_2D' => 'SLIDING_2_DAUN',
        'SWING_1D' => 'SWING_1_DAUN',
        'SWING_2D' => 'SWING_2_DAUN',
        'SWING_3D' => 'SWING_3_DAUN',
        'KACA_MATI_1D' => 'KACA_MATI',
        'ZIGZAG_1D' => 'ZIGZAG',
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
    ];

    /** @var array<string, string> */
    private const MODEL = [
        'JUNGKIT_1_DAUN' => 'Jungkit Satu Daun',
        'JUNGKIT_2_DAUN' => 'Jungkit Dua Daun',
        'JUNGKIT_3_DAUN' => 'Jungkit Tiga Daun',
        'SLIDING_2_DAUN' => 'Sliding Dua Daun',
        'SWING_1_DAUN' => 'Swing Satu Daun',
        'SWING_2_DAUN' => 'Swing Dua Daun',
        'SWING_3_DAUN' => 'Swing Tiga Daun',
        'KACA_MATI' => 'Kaca Mati',
        'ZIGZAG' => 'Zigzag',
        'JUNGKIT' => 'Jungkit',
        'SLIDING' => 'Sliding',
        'SWING' => 'Swing',
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

    /** @return list<string> kode kategori valid (untuk dropdown template import dan validasi) */
    public static function categoryCodes(): array
    {
        return \App\Support\CategoryUrl::productCategoryCodes();
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

    public static function normalizeCategory(?string $code): ?string
    {
        if ($code === null || $code === '' || $code === 'ALL' || $code === 'all') {
            return null;
        }

        $key = strtoupper(trim((string) $code));

        // Kode kanonik Indonesia (JENDELA/PINTU/BOVEN) plus kategori dinamis
        // dari tabel `categories` (bukan daftar tetap). Tidak ada lagi peta
        // alias English; kode warisan tidak dikenali.
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

        // Spasi jadi garis bawah, sama seperti normalizeModel: kode sub model
        // diperlakukan sebagai kode, bukan label bebas. Kontrak 2026-09-18
        // membolehkan kode sub model baru yang diketik admin di form produk.
        $key = strtoupper(str_replace(' ', '_', $code));
        $key = self::DESIGN_ALIASES[$key] ?? $key;

        return $key;
    }

    public static function model(?string $code): string
    {
        $key = self::normalizeModel($code);
        if ($key === null) {
            return '';
        }

        if (isset(self::MODEL[$key])) {
            return self::MODEL[$key];
        }

        $label = \Illuminate\Support\Facades\Cache::remember(
            'catalog.model.label.'.strtolower($key),
            3600,
            function () use ($key): ?string {
                $name = \App\Models\CmsModelProduct::query()
                    ->where('product_model', $key)
                    ->value('name');

                if ($name && str_contains($name, ' Aluminium ')) {
                    $parts = explode(' Aluminium ', $name, 2);
                    return trim($parts[1]);
                }

                return $name;
            }
        );

        if ($label) {
            return $label;
        }

        return self::titleCaseIndonesia($key);
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
    public static function modelCodes(?string $category = null): array
    {
        $categoryKey = $category !== null && $category !== '' ? strtoupper(trim($category)) : 'all';

        return \Illuminate\Support\Facades\Cache::remember('catalog.model_codes.v4.'.$categoryKey, 3600, function () use ($category): array {
            $cmsQuery = \App\Models\CmsModelProduct::query()->where('status', 'active');
            if ($category !== null && $category !== '') {
                $cmsQuery->where('product_category', strtoupper(trim($category)));
            }
            $fromCms = $cmsQuery->orderBy('sort_order')->orderBy('id')
                ->pluck('product_model')
                ->filter()
                ->map(fn ($m) => strtoupper((string) $m))
                ->values()
                ->all();

            $subQuery = \App\Models\SubModel::query()->where('is_active', true);
            $fromSub = $subQuery->distinct()
                ->pluck('product_model')
                ->filter()
                ->map(fn ($m) => strtoupper((string) $m))
                ->values()
                ->all();

            // Model yang sudah dipakai produk tetap sah walau wadahnya
            // (cms_model_products) berstatus nonaktif. Tanpa ini, produk hasil
            // import dengan model JUNGKIT membuat dropdown Model di form admin
            // kosong dan validasi simpan menolak nilai yang sudah tersimpan.
            $productQuery = \App\Models\Product::query()
                ->whereNotNull('product_model')
                ->where('product_model', '<>', '');
            if ($category !== null && $category !== '') {
                $productQuery->where('product_category', strtoupper(trim($category)));
            }
            $fromProducts = $productQuery->distinct()
                ->pluck('product_model')
                ->filter()
                ->map(fn ($m) => strtoupper((string) $m))
                ->values()
                ->all();

            $merged = array_values(array_unique(array_merge($fromCms, $fromSub, $fromProducts)));

            if ($category !== null && $category !== '' && ! empty($fromCms)) {
                return array_values(array_unique(array_merge($fromCms, $fromProducts)));
            }

            return $merged;
        });
    }

    /**
     * Opsi model untuk dropdown form admin (value = code, label = name/title, category = category).
     *
     * @return list<array{value: string, label: string, category: ?string}>
     */
    public static function modelOptions(?string $category = null): array
    {
        $codes = self::modelCodes($category);
        $cmsMap = \App\Models\CmsModelProduct::query()
            ->get(['product_model', 'product_category', 'name'])
            ->keyBy(fn ($item) => strtoupper((string) $item->product_model));

        return collect($codes)->map(function (string $code) use ($cmsMap) {
            $cms = $cmsMap->get($code);
            $catLabel = $cms && $cms->product_category ? self::category($cms->product_category).' · ' : '';

            return [
                'value' => $code,
                'label' => $catLabel . self::model($code),
                'category' => $cms?->product_category ?? null,
            ];
        })->values()->all();
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

        // Murni dari database. Tidak ada lagi daftar cadangan di kode (16 Okt 2026),
        // sejalan dengan penghapusan MODEL_ORDER: saat tabel sub_models kosong,
        // daftar sub model memang kosong.
        return array_values(array_unique($codes));
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
