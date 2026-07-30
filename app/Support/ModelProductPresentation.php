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
                    ['icon' => 'sparkle', 'label' => 'Tampilan Bersih & Modern'],
                    ['icon' => 'sun', 'label' => 'Maksimalkan Pencahayaan'],
                    ['icon' => 'shield-check', 'label' => 'Cocok untuk Berbagai Ruangan'],
                ],
            ],
            'JUNGKIT' => [
                'subtitle' => 'Praktis & Aman',
                'desc' => 'Jendela jungkit cocok untuk kamar mandi dan dapur. Aman dari cipratan air hujan sambil tetap memberi sirkulasi udara.',
                'highlights' => [
                    ['icon' => 'sparkle', 'label' => 'Tahan Cipratan Air'],
                    ['icon' => 'sun', 'label' => 'Sirkulasi Udara Optimal'],
                    ['icon' => 'shield-check', 'label' => 'Aman untuk Area Basah'],
                ],
            ],
            'SLIDING' => [
                'subtitle' => 'Luas & Rapi',
                'desc' => 'Jendela sliding cocok untuk ruangan dengan bukaan lebar dan memberikan kesan rapi pada rumah Anda.',
                'highlights' => [
                    ['icon' => 'columns-3', 'label' => 'Bukaan Lebar Hemat Ruang'],
                    ['icon' => 'sparkle', 'label' => 'Tampilan Rapi Modern'],
                    ['icon' => 'shield-check', 'label' => 'Kokoh untuk Sehari-hari'],
                ],
            ],
            'SWING' => [
                'subtitle' => 'Klasik & Kokoh',
                'desc' => 'Bukaan samping dengan engsel kokoh. Sirkulasi udara optimal untuk ruang tamu dan kamar tidur.',
                'highlights' => [
                    ['icon' => 'door-open', 'label' => 'Bukaan Samping Lebar'],
                    ['icon' => 'sun', 'label' => 'Sirkulasi Udara Optimal'],
                    ['icon' => 'shield-check', 'label' => 'Engsel Kokoh'],
                ],
            ],
            'ZIGZAG' => [
                'subtitle' => 'Ventilasi Optimal',
                'desc' => 'Boven zigzag untuk ventilasi memanjang di area tinggi. Sirkulasi udara merata tanpa mengorbankan privasi.',
                'highlights' => [
                    ['icon' => 'columns-3', 'label' => 'Ventilasi Merata'],
                    ['icon' => 'sun', 'label' => 'Cahaya Alami'],
                    ['icon' => 'shield-check', 'label' => 'Privasi Tetap Terjaga'],
                ],
            ],
        ];

        return $catalog[$key] ?? [
            'subtitle' => 'Siap Pasang',
            'desc' => 'Pilih ukuran dan warna sesuai kebutuhan bangunan Anda.',
            'highlights' => [
                ['icon' => 'sparkle', 'label' => 'Desain Rapi'],
                ['icon' => 'package', 'label' => 'Siap Dikirim'],
                ['icon' => 'shield-check', 'label' => 'Garansi 100 persen'],
            ],
        ];
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
        foreach ($pairs as $pair) {
            $key = self::pairKey($pair['category'] ?? null, $pair['model'] ?? null);
            if ($key === '') {
                continue;
            }
            $out[$key] = ['count' => 0, 'href' => null];
        }

        if ($out === [] || ! Schema::hasTable('product_media') || ! Schema::hasTable('products')) {
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
                        $inner->where('products.product_category', $pair['category'])
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

        foreach ($rows as $row) {
            $key = self::pairKey((string) $row->product_category, (string) $row->product_model);
            if ($key === '' || ! isset($out[$key])) {
                continue;
            }
            $out[$key] = [
                'count' => (int) $row->photo_count,
                'href' => InstallationGallery::modelHref(
                    (string) $row->product_category,
                    (string) $row->product_model,
                ) ?: route('installation.index', absolute: false),
            ];
        }

        return $out;
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
        $card['highlights'] = $presentation['highlights'];
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
