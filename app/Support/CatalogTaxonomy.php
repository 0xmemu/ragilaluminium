<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Taxonomy katalog dari produk hasil import (bukan hardcode menu).
 */
class CatalogTaxonomy
{
    private const CACHE_KEY = 'catalog.taxonomy.v4';

    private const CACHE_TTL_SECONDS = 300;

    /**
     * @return Collection<int, object{product_category: string, product_model: string, design_variant: string, total: int}>
     */
    public static function rows(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () {
            try {
                return Product::visible()
                    ->select(
                        'product_category',
                        'product_model',
                        'design_variant',
                        DB::raw('count(*) as total')
                    )
                    ->groupBy('product_category', 'product_model', 'design_variant')
                    ->get();
            } catch (\Throwable) {
                return collect();
            }
        });
    }

    public static function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::CACHE_KEY.'.megaNav');
        Cache::forget('catalog.taxonomy.v1');
        Cache::forget('catalog.taxonomy.v2');
        Cache::forget('catalog.taxonomy.v2.megaNav');
        Cache::forget('catalog.taxonomy.v2.modelCards.8');
        Cache::forget('catalog.taxonomy.v2.modelCards.v2.8');
    }

    /**
     * Kartu model dari produk visible saat ini (satu kartu per kategori × model).
     *
     * @return list<array{title: string, count: string, meta: string, desc: string, image: ?string, href: string, model: string, category: string, designs: list<string>}>
     */
    public static function modelCards(int $limit = 0, ?string $design = null, ?string $category = null): array
    {
        $design = CatalogLabels::normalizeDesign($design);
        $cacheKey = self::CACHE_KEY.'.modelCards.'.($limit ?: 'all').'.'.($design ?? 'any').'.'.($category ?? 'any');

        $cards = Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($limit, $design, $category) {
            $rows = self::rows();
            if ($rows->isEmpty()) {
                return [];
            }

            if ($design) {
                $rows = $rows->where('design_variant', $design);
            }

            if ($category) {
                $rows = $rows->where('product_category', $category);
            }

            if ($rows->isEmpty()) {
                return [];
            }

            $categoryOrder = ['WINDOW', 'DOOR', 'BOUVEN'];
            $wanted = [];

            foreach ($categoryOrder as $category) {
                $catRows = $rows->where('product_category', $category);
                if ($catRows->isEmpty()) {
                    continue;
                }

                $byModel = $catRows->groupBy('product_model');
                $modelKeys = array_values(array_unique(array_merge(
                    array_values(array_filter(
                        CatalogLabels::MODEL_ORDER,
                        fn (string $m) => $byModel->has($m)
                    )),
                    $byModel->keys()->sort()->all()
                )));

                foreach ($modelKeys as $model) {
                    if (! $byModel->has($model)) {
                        continue;
                    }
                    $modelRows = $byModel->get($model);
                    $wanted[] = [
                        'model' => $model,
                        'category' => $category,
                        'rows' => $modelRows,
                        'designs' => $modelRows->pluck('design_variant')->filter()->unique()->values()->all(),
                    ];
                    if ($limit > 0 && count($wanted) >= $limit) {
                        break 2;
                    }
                }
            }

            $samples = collect();
            if ($wanted !== []) {
                $samples = Product::visible()
                    ->with('mainImage')
                    ->when($design, fn ($q) => $q->where('design_variant', $design))
                    ->where(function ($q) use ($wanted) {
                        foreach ($wanted as $w) {
                            $q->orWhere(function ($q2) use ($w) {
                                $q2->where('product_model', $w['model'])
                                    ->where('product_category', $w['category']);
                            });
                        }
                    })
                    ->latest()
                    ->get()
                    ->unique(fn (Product $p) => $p->product_model.'|'.$p->product_category)
                    ->keyBy(fn (Product $p) => $p->product_model.'|'.$p->product_category);
            }

            $cards = [];
            $pairs = [];
            foreach ($wanted as $w) {
                $sample = $samples->get($w['model'].'|'.$w['category']);
                $categorySlug = CategoryUrl::categoryToSlug((string) $w['category']);
                $route = $design ? 'catalog.design' : 'catalog.model';
                $params = array_filter([
                    'category' => $categorySlug,
                    'model' => strtolower(str_replace('_', '-', $w['model'])),
                    'design' => $design ? strtolower(str_replace('_', '-', $design)) : null,
                ]);

                $pairs[] = [
                    'category' => $w['category'],
                    'model' => $w['model'],
                ];

                $cards[] = [
                    'title' => CatalogLabels::modelCardTitle($w['category'], $w['model']),
                    'count' => (string) (int) $w['rows']->sum('total'),
                    'meta' => '3 Model Kaca | 4 Model Warna',
                    'desc' => self::modelDescription($w['model']),
                    'image' => $sample?->mainImage?->urlFor('card'),
                    'href' => route($route, $params, absolute: false),
                    'model' => $w['model'],
                    'category' => $w['category'],
                    'designs' => $w['designs'],
                ];
            }

            $inspiration = ModelProductPresentation::inspirationByPair($pairs);

            return array_map(
                fn (array $card) => ModelProductPresentation::enrichCard($card, $inspiration),
                $cards,
            );
        });

        // Sortir default "popular" — dihitung segar tiap request agar tidak stale di cache.
        return self::sortByPopularity($cards);
    }

    /**
     * Total kuantitas terjual (validOrderItems) per model untuk sortir "popular".
     *
     * @return array<string, int>
     */
    protected static function modelPopularity(): array
    {
        return Product::visible()
            ->withPopularityScore()
            ->get()
            ->groupBy(
                fn (Product $p) => strtoupper((string) $p->product_category).'|'.strtoupper((string) $p->product_model)
            )
            ->map(fn (Collection $group) => (int) $group->sum(fn (Product $product) => (int) ($product->sold_count ?? 0) + (int) ($product->popularity_seed ?? 0)))
            ->all();
    }

    /**
     * Urutkan kartu model: total penjualan tertinggi di depan (default "popular").
     *
     * @param  list<array<string, mixed>>  $cards
     * @return list<array<string, mixed>>
     */
    protected static function sortByPopularity(array $cards): array
    {
        if ($cards === []) {
            return $cards;
        }

        $popularity = self::modelPopularity();
        $score = static fn (array $card) => (int) (
            $popularity[
                strtoupper((string) ($card['category'] ?? '')).'|'.strtoupper((string) ($card['model'] ?? ''))
            ] ?? 0
        );

        usort(
            $cards,
            fn (array $a, array $b): int => $score($b) <=> $score($a)
                ?: strcmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''))
        );

        return $cards;
    }

    /**
     * Chip filter desain yang ada di katalog visible.
     *
     * @return list<array{value: string, label: string}>
     */
    public static function availableDesignFilters(): array
    {
        $present = self::rows()->pluck('design_variant')->filter()->unique()->all();

        $ordered = array_values(array_filter(
            CatalogLabels::DESIGN_ORDER,
            fn (string $d) => in_array($d, $present, true)
        ));

        foreach ($present as $d) {
            if (! in_array($d, $ordered, true)) {
                $ordered[] = $d;
            }
        }

        return array_map(
            fn (string $code) => [
                'value' => $code,
                'label' => CatalogLabels::design($code) ?: $code,
            ],
            $ordered
        );
    }

    /**
     * @return list<string>
     */
    public static function models(?string $category = null): array
    {
        $rows = self::rows();
        if ($category) {
            $rows = $rows->where('product_category', strtoupper($category));
        }

        $present = $rows->pluck('product_model')->unique()->all();

        $ordered = array_values(array_filter(
            CatalogLabels::MODEL_ORDER,
            fn (string $m) => in_array($m, $present, true)
        ));

        foreach ($present as $m) {
            if (! in_array($m, $ordered, true)) {
                $ordered[] = $m;
            }
        }

        return $ordered;
    }

    /**
     * Fallback / flat columns (kompatibel config sitemap).
     *
     * @return list<array{title: string, route: string, items: list<array{label: string, model: ?string, design: ?string}>}>
     */
    public static function megaMenu(): array
    {
        $nav = self::megaMenuNav();

        return collect($nav['panels'])
            ->map(fn (array $panel) => [
                'title' => $panel['title'],
                'route' => $panel['route'],
                'items' => $panel['items'],
            ])
            ->values()
            ->all();
    }

    /**
     * Struktur mega-menu gaya Zalora: sidebar kategori + panel kanan.
     * Hasil di-cache utuh (termasuk sampel) agar composerview tidak N+1 tiap request.
     *
     * @return array{
     *   sidebar: list<array{key: string, label: string, icon: string}>,
     *   panels: array<string, array{title: string, route: string, shop_all: string, items: list<array{label: string, model: ?string, design: ?string, href: string}>, samples: list<array{title: string, image: ?string, href: string}>}>
     * }
     */
    public static function megaMenuNav(): array
    {
        return Cache::remember(self::CACHE_KEY.'.megaNav', self::CACHE_TTL_SECONDS, function () {
            return self::buildMegaMenuNav();
        });
    }

    /**
     * @return array{sidebar: list<array{key: string, label: string, icon: string}>, panels: array<string, array>}
     */
    private static function buildMegaMenuNav(): array
    {
        $rows = self::rows();
        $columns = [
            'WINDOW' => ['title' => 'Jendela Aluminium', 'route' => 'catalog.windows', 'icon' => 'layout-grid'],
            'DOOR' => ['title' => 'Pintu Aluminium', 'route' => 'catalog.doors', 'icon' => 'door-open'],
            'BOUVEN' => ['title' => 'Boven Aluminium', 'route' => 'catalog.bouven', 'icon' => 'columns-3'],
        ];

        $sidebar = [];
        $panels = [];
        $samplesByCategory = self::sampleProductsByCategory(array_keys($columns), 6);

        foreach ($columns as $category => $meta) {
            $catRows = $rows->where('product_category', $category);
            if ($catRows->isEmpty() && $rows->isNotEmpty()) {
                continue;
            }

            if ($rows->isEmpty()) {
                $fallback = collect(config('sitemap.navigation.mega_menu', []))
                    ->firstWhere('route', $meta['route']);
                $items = collect($fallback['items'] ?? [])->map(function (array $item) use ($meta) {
                    $params = array_filter([
                        'model' => CatalogLabels::normalizeModel($item['model'] ?? null),
                        'design' => CatalogLabels::normalizeDesign($item['design'] ?? null),
                    ], fn ($v) => filled($v));

                    return [
                        'label' => $item['label'],
                        'model' => $params['model'] ?? null,
                        'design' => $params['design'] ?? null,
                        'href' => PublicNavigation::canonicalHref($meta['route'], $params, false),
                    ];
                })->all();
            } else {
                $items = [];
                foreach (CatalogLabels::MODEL_ORDER as $model) {
                    $modelRows = $catRows->where('product_model', $model);
                    if ($modelRows->isEmpty()) {
                        continue;
                    }

                    foreach (CatalogLabels::DESIGN_ORDER as $design) {
                        $hit = $modelRows->firstWhere('design_variant', $design);
                        if (! $hit) {
                            continue;
                        }

                        $params = array_filter([
                            'model' => $model,
                            'design' => $design === 'POLOS' ? null : $design,
                        ], fn ($v) => filled($v));

                        $items[] = [
                            'label' => CatalogLabels::productLine($category, $model, $design),
                            'model' => $model,
                            'design' => $design === 'POLOS' ? null : $design,
                            'href' => PublicNavigation::canonicalHref($meta['route'], $params, false),
                        ];
                    }
                }
            }

            if ($items === []) {
                continue;
            }

            $sidebar[] = [
                'key' => $category,
                'label' => $meta['title'],
                'icon' => $meta['icon'],
            ];

            $panels[$category] = [
                'title' => $meta['title'],
                'route' => $meta['route'],
                'shop_all' => PublicNavigation::canonicalHref($meta['route'], [], false),
                'items' => $items,
                'samples' => $samplesByCategory[$category] ?? [],
            ];
        }

        if ($sidebar === []) {
            return self::fallbackMegaNav();
        }

        return compact('sidebar', 'panels');
    }

    /**
     * @param  list<string>  $categories
     * @return array<string, list<array{title: string, image: ?string, href: string}>>
     */
    private static function sampleProductsByCategory(array $categories, int $limit = 6): array
    {
        $out = array_fill_keys($categories, []);

        try {
            $products = Product::visible()
                ->with('mainImage')
                ->whereIn('product_category', $categories)
                ->latest()
                ->limit(max(1, count($categories) * $limit * 2))
                ->get();

            foreach ($products as $p) {
                $cat = $p->product_category;
                if (! isset($out[$cat]) || count($out[$cat]) >= $limit) {
                    continue;
                }
                $out[$cat][] = [
                    'title' => $p->short_name ?: mb_strimwidth($p->name, 0, 48, '…'),
                    'image' => $p->mainImage?->urlFor('card'),
                    'href' => route('product.show', $p->parent_sku, absolute: false),
                ];
            }
        } catch (\Throwable) {
            // ignore
        }

        return $out;
    }

    private static function modelDescription(string $model): string
    {
        return match (strtoupper($model)) {
            'JUNGKIT' => 'Jendela jungkit cocok untuk kamar mandi dan dapur. Aman dari cipratan air hujan sambil tetap memberi sirkulasi udara.',
            'SLIDING' => 'Jendela sliding cocok untuk ruangan dengan bukaan lebar dan memberikan kesan rapi pada rumah Anda.',
            'SWING' => 'Bukaan samping dengan engsel kokoh. Sirkulasi udara optimal untuk ruang tamu dan kamar tidur.',
            'KACA_MATI' => 'Pencahayaan maksimal tanpa daun bukaan. Ideal untuk area yang membutuhkan cahaya alami tanpa ventilasi aktif.',
            'ZIGZAG' => 'Boven zigzag untuk ventilasi memanjang di area tinggi. Sirkulasi udara merata tanpa mengorbankan privasi.',
            default => 'Pilih ukuran dan warna sesuai kebutuhan bangunan Anda.',
        };
    }

    /**
     * @return array{sidebar: list<array{key: string, label: string, icon: string}>, panels: array<string, array>}
     */
    private static function fallbackMegaNav(): array
    {
        $sidebar = [];
        $panels = [];

        foreach (config('sitemap.navigation.mega_menu', []) as $column) {
            $key = match ($column['route'] ?? '') {
                'catalog.doors' => 'DOOR',
                'catalog.bouven' => 'BOUVEN',
                default => 'WINDOW',
            };

            $items = collect($column['items'] ?? [])->map(function (array $item) use ($column) {
                $params = array_filter([
                    'model' => CatalogLabels::normalizeModel($item['model'] ?? null),
                    'design' => CatalogLabels::normalizeDesign($item['design'] ?? null),
                ], fn ($v) => filled($v));

                return [
                    'label' => $item['label'],
                    'model' => $params['model'] ?? null,
                    'design' => $params['design'] ?? null,
                    'href' => PublicNavigation::canonicalHref($column['route'], $params, false),
                ];
            })->all();

            $sidebar[] = [
                'key' => $key,
                'label' => $column['title'],
                'icon' => match ($key) {
                    'DOOR' => 'door-open',
                    'BOUVEN' => 'columns-3',
                    default => 'layout-grid',
                },
            ];

            $panels[$key] = [
                'title' => $column['title'],
                'route' => $column['route'],
                'shop_all' => PublicNavigation::canonicalHref($column['route'], [], false),
                'items' => $items,
                'samples' => [],
            ];
        }

        return compact('sidebar', 'panels');
    }
}
