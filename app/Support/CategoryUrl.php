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

        return self::FALLBACK_SLUG_BY_CODE[$key] ?? 'jendela';
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
     * Baris kategori aktif dari tabel `categories` (dipakai ganda: ke-slug & ke-kode).
     *
     * @return list<array{code: string, slug: string, label: string}>
     */
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
