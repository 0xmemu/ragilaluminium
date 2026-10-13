<?php

namespace App\Support;

use App\Models\Category;
use Illuminate\Support\Facades\Cache;

/**
 * Pemetaan terpusat antara kode kategori (`products.product_category`, kode
 * kanonik Bahasa Indonesia JENDELA/PINTU/BOVEN) dan slug URL kanonik Bahasa
 * Indonesia (`categories.slug`: jendela/pintu/boven).
 *
 * Kolom products.product_category memakai kode kanonik yang SAMA dengan
 * `categories.code`; hanya slug URL yang berbeda bentuk (huruf kecil). Tabel
 * `categories` adalah sumber tunggal slug kanonik. Kode warisan English
 * (WINDOW/DOOR/BOUVEN) sudah tidak didukung di lapisan data; sisa tautan lama
 * ditangani di lapisan URL lewat LEGACY_URL_REDIRECT.
 */
class CategoryUrl
{
    /** Kode kategori kanonik (identitas: categories.code == products.product_category). */
    private const CODE_TO_PRODUCT = [
        'JENDELA' => 'JENDELA',
        'PINTU' => 'PINTU',
        'BOVEN' => 'BOVEN',
    ];

    /**
     * Slug English lama yang masih dialihkan ke slug kanonik, HANYA di lapisan
     * URL (redirect 301 anti duplicate-content). Peta ini tidak pernah dipakai
     * untuk memetakan kode produk: kode warisan tidak lagi dikenali sebagai
     * kategori data. Tambah baris di sini bila ada tautan lama lain.
     *
     * @var array<string, string>
     */
    private const LEGACY_URL_REDIRECT = [
        'window' => 'jendela',
        'windows' => 'jendela',
        'door' => 'pintu',
        'doors' => 'pintu',
        'bouven' => 'boven',
    ];

    /** TTL cache (detik) peta slug baca-tabel. */
    private const CACHE_TTL = 300;

    /**
     * Bedakan kode ke slug URL kanonik (Indonesia). Menerima kode kanonik
     * (JENDELA/PINTU/BOVEN) maupun kode kategori baru dari tabel `categories`;
     * penelusuran tabel didahulukan, lalu fallback bentuk huruf kecil.
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

        return strtolower($key);
    }

    /**
     * Normalkan slug ke kode product_category kanonik. Resolusi HANYA lewat
     * tabel `categories.slug`; return null bila slug tidak dikenal. Alias
     * English tidak lagi memetakan kode (penanganannya hanya redirect URL).
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

        return null;
    }

    /**
     * Slug URL Indonesia kanonik untuk sebuah slug kategori. Menerima slug
     * kanonik dari tabel `categories` maupun alias URL English lama
     * (window/windows/door/doors/bouven) agar tautan lama tetap dialihkan 301
     * ke kanonik. Return null bila slug bukan kategori (tidak diakui tabel
     * maupun peta URL).
     */
    public static function canonicalSlug(string $slug): ?string
    {
        $key = strtolower(trim((string) $slug));
        if ($key === '') {
            return null;
        }

        $code = self::categoryFromSlug($key);
        if ($code !== null) {
            return self::categoryToSlug($code);
        }

        return self::LEGACY_URL_REDIRECT[$key] ?? null;
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
     * Terjemahkan kode kategori (categories.code, mis. JENDELA) ke kode
     * products.product_category. Keduanya kini identitas; helper tetap ada
     * supaya kategori baru dapat memakai pemetaan sendiri bila diperlukan.
     */
    public static function codeToProductCode(string $code): string
    {
        $key = strtoupper(trim((string) $code));

        return self::CODE_TO_PRODUCT[$key] ?? $key;
    }

    /**
     * Kode produk (products.product_category) yang didukung tabel categories.
     * Urutan mengikuti sort_order (kanonik navigasi). Dipakai untuk validasi
     * dinamis di form produk / model produk, bukan daftar tetap.
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
