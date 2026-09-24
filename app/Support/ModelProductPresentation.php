<?php

namespace App\Support;

use App\Models\ProductMedia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Copy + inspiration stats for storefront model cards / detail dialog.
 * Derived from product_model (no extra CMS columns).
 */
class ModelProductPresentation
{
    /**
     * Cache hasil cek tabel. Schema::hasTable menempuh information_schema dan
     * dipanggil berulang dalam satu request.
     *
     * @var array<string, bool>
     */
    private static array $tableCache = [];

    private static function hasTable(string $table): bool
    {
        return self::$tableCache[$table] ??= Schema::hasTable($table);
    }

    /**
     * @return array{subtitle: string, desc: string, highlights: list<array{icon: string, label: string}>}
     */
    public static function forModel(string $model): array
    {
        $key = strtoupper(trim($model));
        $catalog = [
            'KACA_MATI' => [
                'subtitle' => 'Timeless & Minimalis',
                'desc' => 'Desain sederhana dengan kaca mati polos yang memberi kesan bersih, terang, dan elegan untuk setiap hunian. Cocok untuk memaksimalkan pencahayaan alami tanpa mengurangi privasi.',
                'highlights' => [
                    ['icon' => 'sparkle', 'label' => 'Tampilan Modern'],
                    ['icon' => 'sun', 'label' => 'Cahaya Maksimal'],
                    ['icon' => 'shield-check', 'label' => 'Serbaguna'],
                ],
            ],
            'JUNGKIT' => [
                'subtitle' => 'Praktis & Aman',
                'desc' => 'Jendela jungkit cocok untuk kamar mandi dan dapur. Aman dari cipratan air hujan sambil tetap memberi sirkulasi udara.',
                'highlights' => [
                    ['icon' => 'sparkle', 'label' => 'Tahan Air'],
                    ['icon' => 'sun', 'label' => 'Sirkulasi Optimal'],
                    ['icon' => 'shield-check', 'label' => 'Anti Basah'],
                ],
            ],
            'SLIDING' => [
                'subtitle' => 'Luas & Rapi',
                'desc' => 'Jendela sliding cocok untuk ruangan dengan bukaan lebar dan memberikan kesan rapi pada rumah Anda.',
                'highlights' => [
                    ['icon' => 'columns-3', 'label' => 'Bukaan Lebar'],
                    ['icon' => 'sparkle', 'label' => 'Rapi Modern'],
                    ['icon' => 'shield-check', 'label' => 'Kokoh Harian'],
                ],
            ],
            'SWING' => [
                'subtitle' => 'Klasik & Kokoh',
                'desc' => 'Bukaan samping dengan engsel kokoh. Sirkulasi udara optimal untuk ruang tamu dan kamar tidur.',
                'highlights' => [
                    ['icon' => 'door-open', 'label' => 'Bukaan Samping'],
                    ['icon' => 'sun', 'label' => 'Sirkulasi Optimal'],
                    ['icon' => 'shield-check', 'label' => 'Engsel Kokoh'],
                ],
            ],
            'ZIGZAG' => [
                'subtitle' => 'Ventilasi Optimal',
                'desc' => 'Boven zigzag untuk ventilasi memanjang di area tinggi. Sirkulasi udara merata tanpa mengorbankan privasi.',
                'highlights' => [
                    ['icon' => 'columns-3', 'label' => 'Ventilasi Merata'],
                    ['icon' => 'sun', 'label' => 'Cahaya Alami'],
                    ['icon' => 'shield-check', 'label' => 'Privasi Terjaga'],
                ],
            ],
        ];

        return $catalog[$key] ?? [
            'subtitle' => 'Siap Pasang',
            'desc' => 'Pilih ukuran dan warna sesuai kebutuhan bangunan Anda.',
            'highlights' => [
                ['icon' => 'sparkle', 'label' => 'Desain Rapi'],
                ['icon' => 'package', 'label' => 'Siap Dikirim'],
                ['icon' => 'shield-check', 'label' => 'Garansi Penuh'],
            ],
        ];
    }


    /**
     * Kata kunci admin -> pill keunggulan (icon otomatis mengikuti urutan).
     *
     * @param  list<string>  $keywords
     * @return list<array{icon: string, label: string}>
     */
    public static function highlightsFromKeywords(array $keywords): array
    {
        $icons = ['sparkle', 'sun', 'shield-check'];
        $out = [];
        foreach (array_values($keywords) as $index => $keyword) {
            $label = trim((string) $keyword);
            if ($label === '') {
                continue;
            }
            $out[] = ['icon' => $icons[$index % count($icons)], 'label' => $label];
        }

        return $out;
    }

    /**
     * Batch inspiration (installation) photo counts + deep-link per category|model.
     *
     * @param  list<array{category: string, model: string}>  $pairs
     * @return array<string, array{count: int, href: string|null}>
     */
    public static function inspirationByPair(array $pairs): array
    {
        $out = [];
        $lookup = [];
        foreach ($pairs as $pair) {
            $key = self::pairKey($pair['category'] ?? null, $pair['model'] ?? null);
            if ($key === '') {
                continue;
            }
            $out[$key] = ['count' => 0, 'href' => null];
            // Kunci ternormalisasi (kode kanonik) dipakai untuk mencocokkan baris
            // products yang mungkin masih memakai kode warisan (WINDOW/DOOR).
            $normalized = self::normalizedPairKey($pair['category'] ?? null, $pair['model'] ?? null);
            if ($normalized !== '') {
                $lookup[$normalized][] = $key;
            }
        }

        if ($out === [] || ! self::hasTable('product_media') || ! self::hasTable('products')) {
            return $out;
        }

        $rows = ProductMedia::query()
            ->installation()
            ->visible()
            ->join('products', 'products.id', '=', 'product_media.product_id')
            ->where('products.status', 'active')
            ->where(function ($q) use ($pairs) {
                foreach ($pairs as $pair) {
                    if (! filled($pair['category'] ?? null) || ! filled($pair['model'] ?? null)) {
                        continue;
                    }
                    $q->orWhere(function ($inner) use ($pair) {
                        $inner->whereIn('products.product_category', self::categoryCandidates($pair['category']))
                            ->where('products.product_model', $pair['model']);
                    });
                }
            })
            ->groupBy('products.product_category', 'products.product_model')
            ->select([
                'products.product_category',
                'products.product_model',
                DB::raw('COUNT(product_media.id) as photo_count'),
            ])
            ->get();

        // Agregasi per kunci ternormalisasi (kode kanonik) supaya baris products
        // yang masih memakai kode warisan (WINDOW/DOOR) ikut terhitung dan tidak
        // dobel saat satu model punya baris kanonik dan baris warisan sekaligus.
        $aggregated = [];
        foreach ($rows as $row) {
            $normalized = self::normalizedPairKey((string) $row->product_category, (string) $row->product_model);
            if ($normalized === '' || ! isset($lookup[$normalized])) {
                continue;
            }

            $aggregated[$normalized] ??= ['count' => 0, 'href' => null];
            $aggregated[$normalized]['count'] += (int) $row->photo_count;
            $aggregated[$normalized]['href'] ??= InstallationGallery::modelHref(
                (string) $row->product_category,
                (string) $row->product_model,
            ) ?: route('installation.index', absolute: false);
        }

        foreach ($lookup as $normalized => $keys) {
            $data = $aggregated[$normalized] ?? null;
            if ($data === null) {
                continue;
            }
            foreach ($keys as $key) {
                $out[$key] = $data;
            }
        }

        return $out;
    }

    /**
     * Kandidat kode product_category untuk satu kode kategori. Kode kategori
     * tabel `categories` identik dengan kode products.product_category, jadi
     * hasilnya satu kode kanonik. Kode warisan tidak lagi dikenali.
     *
     * @return list<string>
     */
    private static function categoryCandidates(?string $category): array
    {
        if ($category === null || $category === '') {
            return [];
        }

        $code = CategoryUrl::codeToProductCode($category);

        return $code === '' ? [] : [$code];
    }

    /** Kunci pasangan kategori|model dengan kategori sudah dinormalkan ke kanonik. */
    private static function normalizedPairKey(?string $category, ?string $model): string
    {
        if (! filled($category) || ! filled($model)) {
            return '';
        }

        return strtoupper(CategoryUrl::codeToProductCode((string) $category)).'|'.strtoupper((string) $model);
    }

    public static function pairKey(?string $category, ?string $model): string
    {
        if (! $category || ! $model) {
            return '';
        }

        return strtoupper($category).'|'.strtoupper($model);
    }

    /**
     * Merge presentation fields onto a storefront card array.
     *
     * @param  array<string, mixed>  $card
     * @param  array<string, array{count: int, href: string|null}>  $inspiration
     * @return array<string, mixed>
     */
    public static function enrichCard(array $card, array $inspiration = []): array
    {
        $model = (string) ($card['model'] ?? '');
        $category = (string) ($card['category'] ?? '');
        $presentation = self::forModel($model);
        $key = self::pairKey($category, $model);
        $insp = $inspiration[$key] ?? ['count' => 0, 'href' => null];

        $count = (int) ($insp['count'] ?? 0);
        $inspirationHref = $count > 0
            ? ($insp['href'] ?: route('installation.index', absolute: false))
            : (string) ($card['href'] ?? route('installation.index', absolute: false));

        // Tagline/subtitle tidak ditampilkan di storefront; deskripsi dari CMS bila ada.
        $card['subtitle'] = null;
        $existingDesc = trim((string) ($card['desc'] ?? ''));
        $card['desc'] = $existingDesc !== '' ? $existingDesc : $presentation['desc'];
        $existingKeywords = $card['keywords'] ?? [];
        $card['highlights'] = filled($existingKeywords)
            ? self::highlightsFromKeywords($existingKeywords)
            : $presentation['highlights'];
        $card['inspiration_count'] = $count;
        $card['inspiration_href'] = $inspirationHref;
        $card['detail_href'] = ($category !== '' && $model !== '')
            ? route('catalog.model', [
                'category' => InstallationGallery::categoryToSlug($category),
                'model' => InstallationGallery::modelToSlug($model),
            ], absolute: false)
            : (string) ($card['href'] ?? route('catalog.index', absolute: false));

        return $card;
    }
}
