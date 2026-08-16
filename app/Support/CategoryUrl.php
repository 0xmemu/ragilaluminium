<?php

namespace App\Support;

use App\Models\Category;
use Illuminate\Support\Facades\Cache;

/**
 * Pemetaan terpusat antara kode kategori (products.product_category; internal
 * WINDOW/DOOR/BOUVEN) dan slug URL kanonik Bahasa Indonesia (categories.slug:
 * jendela/pintu/boven).
 *
 * Kolom products.product_category TETAP kode internal; hanya slug URL yang
 * dipusatkan ke bentuk Indonesia lewat helper ini. Tabel `categories` (berkode
 * JENDELA/PINTU/BOVEN) adalah sumber slug kanonik.
 */
class CategoryUrl
{
    /** Map kode categories (Indonesia) -> kode internal products.product_category. */
    private const CODE_TO_PRODUCT = [
        'JENDELA' => 'WINDOW',
        'PINTU' => 'DOOR',
        'BOVEN' => 'BOUVEN',
    ];

    /** Fallback slug per kode internal, bila baris categories tidak ditemukan. */
    private const FALLBACK_SLUG_BY_CODE = [
        'WINDOW' => 'jendela',
        'DOOR' => 'pintu',
        'BOUVEN' => 'boven',
    ];

    /** Alias slug English (back-compat) -> kode internal. */
    private const ALIAS_SLUG_TO_CODE = [
        'window' => 'WINDOW',
        'windows' => 'WINDOW',
        'door' => 'DOOR',
        'doors' => 'DOOR',
        'bouven' => 'BOUVEN',
        'boven' => 'BOUVEN',
    ];

    /** TTL cache (detik) peta slug baca-tabel. */
    private const CACHE_TTL = 300;

    /**
     * Bedakan kode ke slug URL kanonik (Indonesia).
     * Terima kode internal (WINDOW/DOOR/BOUVEN) maupun kode categories
     * (JENDELA/PINTU/BOVEN); penelusuran tabel didahulukan, lalu fallback.
     */
    public static function categoryToSlug(string $code): string
    {
        $key = strtoupper(trim((string) $code));
        if ($key === '') {
            return 'jendela';
        }

        foreach (self::categoryRows() as $row) {
            if (strtoupper((string) $row['code']) === $key) {
                return (string) $row['slug'];
            }
        }

        return self::FALLBACK_SLUG_BY_CODE[$key] ?? strtolower($key);
    }

    /**
     * Normalkan slug ke kode product_category internal (WINDOW/DOOR/BOUVEN).
     * Terima slug Indonesia dari tabel categories + alias English back-compat.
     * Return null bila tak dikenal.
     */
    public static function categoryFromSlug(string $slug): ?string
    {
        $key = strtolower(trim((string) $slug));
        if ($key === '') {
            return null;
        }

        foreach (self::categoryRows() as $row) {
            if (strtolower((string) $row['slug']) === $key) {
                $code = strtoupper((string) $row['code']);

                return self::CODE_TO_PRODUCT[$code] ?? $code;
            }
        }

        return self::ALIAS_SLUG_TO_CODE[$key] ?? null;
    }

    /**
     * Slug URL Indonesia kanonik untuk sebuah slug kategori.
     * Terima slug Indonesia maupun alias English back-compat (window/windows/...).
     * Return null bila slug tidak dikenal (bukan kategori).
     */
    public static function canonicalSlug(string $slug): ?string
    {
        $key = strtolower(trim((string) $slug));
        if ($key === '') {
            return null;
        }

        $code = self::categoryFromSlug($key);
        if ($code === null) {
            return null;
        }

        return self::categoryToSlug($code);
    }

    /**
     * Daftar kategori aktif untuk navigasi (slug kanonik, kode internal, label).
     *
     * @return list<array{slug: string, code: string, label: string}>
     */
    public static function categoryLinks(): array
    {
        return collect(self::categoryRows())->map(fn (array $row) => [
            'slug' => (string) $row['slug'],
            'code' => self::CODE_TO_PRODUCT[strtoupper((string) $row['code'])] ?? strtoupper((string) $row['code']),
            'label' => (string) $row['label'],
        ])->values()->all();
    }

    /**
     * Terjemahkan kode kategori (categories.code, e.g. JENDELA) ke kode internal
     * products.product_category (e.g. WINDOW). Kategori baru (tidak punya alias
     * legacy) memetakan ke dirinya sendiri, sehingga admin bebas menambah kategori.
     */
    public static function codeToProductCode(string $code): string
    {
        $key = strtoupper(trim((string) $code));

        return self::CODE_TO_PRODUCT[$key] ?? $key;
    }

    /**
     * Kode produk (products.product_category) yang didukung tabel categories.
     * Urutan mengikuti sort_order (kanonik navigasi). Dipakai untuk validasi
     * dinamis di form produk / model produk, bukan daftar tetap WINDOW/DOOR.
     */
    public static function productCategoryCodes(int $limit = 0): array
    {
        $codes = Category::query()
            ->orderBy("sort_order")
            ->orderBy("id")
            ->get(["code"])
            ->map(fn (Category $c) => self::codeToProductCode((string) $c->code))
            ->filter(fn (string $v) => $v !== "")
            ->unique()
            ->values()
            ->all();

        if ($limit <= 0) {
            return $codes;
        }

        return array_slice($codes, 0, $limit);
    }

    /** Bersihkan cache peta kategori agar kategori baru muncul segera. */
    public static function forgetCache(): void
    {
        Cache::forget("category.url.rows");

        // Bersihkan label kategori yang pernah di-cache per kode produk.
        foreach (self::productCategoryCodes() as $productCode) {
            Cache::forget("catalog.category.label.".strtolower($productCode));
        }
    }

    private static function categoryRows(): array
    {
        return Cache::remember('category.url.rows', self::CACHE_TTL, function () {
            return Category::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(['code', 'slug', 'name'])
                ->map(fn (Category $c) => [
                    'code' => (string) $c->code,
                    'slug' => (string) $c->slug,
                    'label' => (string) $c->name,
                ])
                ->values()
                ->all();
        });
    }
}
