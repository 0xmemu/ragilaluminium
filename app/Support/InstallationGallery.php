<?php

namespace App\Support;

use App\Models\CmsGalleryItem;
use App\Models\Product;
use App\Models\ProductMedia;
use Illuminate\Support\Collection;

/**
 * Public Hasil Pemasangan hierarchy:
 * 1) /hasil-pemasangan — kartu per model (total produk / foto / video)
 * 2) /hasil-pemasangan/{category}/{model} — kartu produk dalam model
 * 3) /hasil-pemasangan/{parent_sku} — galeri foto satu produk
 */
class InstallationGallery
{
    /**
     * One card per catalog model that has installation media.
     *
     * @return list<array{id: string, image_url: string, label: string, product_count: int, photo_count: int, video_count: int, category: string, model: string, source: string, product_sku: null, href: string}>
     */
    public static function modelCards(int $limit = 24): array
    {
        $media = self::installationMediaWithProduct();
        if ($media->isEmpty()) {
            return self::manualModelFallback($limit);
        }

        $grouped = $media->groupBy(
            fn (ProductMedia $item) => strtoupper((string) $item->product->product_category)
                .'|'.strtoupper((string) $item->product->product_model)
        );

        $cards = [];
        foreach (self::orderedPairKeys($grouped->keys()->all()) as $pairKey) {
            /** @var Collection<int, ProductMedia> $group */
            $group = $grouped->get($pairKey);
            if (! $group instanceof Collection || $group->isEmpty()) {
                continue;
            }

            $product = $group->first()?->product;
            if (! $product instanceof Product) {
                continue;
            }

            $category = strtoupper((string) $product->product_category);
            $model = strtoupper((string) $product->product_model);
            $stats = self::countMedia($group);
            if ($stats['cover'] === null) {
                continue;
            }

            $cards[] = [
                'id' => 'model-'.$category.'-'.$model,
                'image_url' => $stats['cover'],
                'label' => CatalogLabels::modelCardTitle($category, $model),
                'product_count' => $group->pluck('product_id')->unique()->count(),
                'photo_count' => $stats['photo_count'],
                'video_count' => $stats['video_count'],
                'category' => $category,
                'model' => $model,
                'source' => 'import',
                'product_sku' => null,
                'href' => route('installation.model', [
                    'category' => self::categoryToSlug($category),
                    'model' => self::modelToSlug($model),
                ], absolute: false),
            ];

            if (count($cards) >= $limit) {
                break;
            }
        }

        $remaining = max(0, $limit - count($cards));
        if ($remaining > 0) {
            $manual = self::manualModelFallback($remaining);
            $cards = array_merge($cards, $manual);
        }

        return array_values($cards);
    }

    /**
     * Product cards within one model (for /hasil-pemasangan/{category}/{model}).
     *
     * @return list<array{id: string, image_url: string, label: string, product_count: int, photo_count: int, video_count: int, category: string, model: string, source: string, product_sku: string|null, href: string|null}>
     */
    public static function productCardsForModel(string $category, string $model, int $limit = 48): array
    {
        $category = strtoupper(trim($category));
        $model = strtoupper(trim($model));

        $media = self::installationMediaWithProduct()
            ->filter(fn (ProductMedia $item) => strtoupper((string) $item->product->product_category) === $category
                && strtoupper((string) $item->product->product_model) === $model);

        return self::productCardsFromMedia($media, $limit);
    }

    /**
     * All product-level installation cards (legacy / helpers).
     *
     * @return list<array{id: string, image_url: string, label: string, product_count: int, photo_count: int, video_count: int, category: string|null, model: string|null, source: string, product_sku: string|null, href: string|null}>
     */
    public static function productCards(int $limit = 24): array
    {
        $cards = self::productCardsFromMedia(self::installationMediaWithProduct(), $limit);

        $remaining = max(0, $limit - count($cards));
        if ($remaining > 0) {
            $manual = CmsGalleryItem::query()
                ->where('published', true)
                ->whereNotNull('image_url')
                ->where('image_url', '!=', '')
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->limit($remaining)
                ->get()
                ->map(fn (CmsGalleryItem $item) => [
                    'id' => 'cms-'.$item->id,
                    'image_url' => $item->image_url,
                    'label' => $item->label ?: 'Hasil pemasangan',
                    'product_count' => 1,
                    'photo_count' => 1,
                    'video_count' => 0,
                    'category' => null,
                    'model' => null,
                    'source' => 'manual',
                    'product_sku' => null,
                    'href' => route('installation.index', absolute: false),
                ])
                ->all();

            $cards = array_merge($cards, $manual);
        }

        return array_values($cards);
    }

    /**
     * @deprecated Prefer modelCards() for listing pages.
     *
     * @return list<array<string, mixed>>
     */
    public static function items(int $limit = 24): array
    {
        return self::productCards($limit);
    }

    /**
     * Home strip: model cards.
     *
     * @return list<array{id: string, image: string, label: string, product_count: int, photo_count: int, video_count: int, category: string|null, model: string|null, href: string|null, product_sku: string|null}>
     */
    public static function forHome(int $limit = 8): array
    {
        return collect(self::modelCards($limit))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'image' => $item['image_url'],
                'label' => $item['label'],
                'product_count' => $item['product_count'],
                'photo_count' => $item['photo_count'],
                'video_count' => $item['video_count'],
                'category' => $item['category'] ?? null,
                'model' => $item['model'] ?? null,
                'href' => $item['href'],
                'product_sku' => $item['product_sku'] ?? null,
            ])
            ->all();
    }

    /**
     * Full installation gallery for one product (detail page).
     *
     * @return array{product: array{id: int, parent_sku: string, name: string, href: string, category: string|null, model: string|null}, media: list<array{id: int, url: string, thumb: string|null}>}|null
     */
    public static function forProduct(Product $product): ?array
    {
        $media = ProductMedia::query()
            ->where('product_id', $product->id)
            ->installation()
            ->visible()
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->map(function (ProductMedia $item) {
                $url = $item->urlFor('pdp')
                    ?? $item->urlFor('card')
                    ?? $item->urlFor('thumb')
                    ?? (config('media.allow_source_url_fallback') ? $item->source_url : null);
                if (! filled($url)) {
                    return null;
                }

                return [
                    'id' => $item->id,
                    'url' => $url,
                    'thumb' => $item->urlFor('thumb') ?? $item->urlFor('card') ?? $url,
                ];
            })
            ->filter()
            ->values()
            ->all();

        if ($media === []) {
            return null;
        }

        $title = trim((string) ($product->short_name ?: $product->name ?: $product->parent_sku));

        return [
            'product' => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $title !== '' ? $title : $product->parent_sku,
                'href' => route('product.show', ['parent_sku' => $product->parent_sku], absolute: false),
                'category' => $product->product_category ? strtoupper((string) $product->product_category) : null,
                'model' => $product->product_model ? strtoupper((string) $product->product_model) : null,
            ],
            'media' => $media,
        ];
    }

    public static function categoryToSlug(string $category): string
    {
        return match (strtoupper($category)) {
            'DOOR' => 'door',
            'BOUVEN' => 'bouven',
            'LAINNYA' => 'lainnya',
            default => 'window',
        };
    }

    public static function categoryFromSlug(string $slug): ?string
    {
        return match (strtolower(trim($slug))) {
            'door', 'doors', 'pintu' => 'DOOR',
            'bouven', 'boven' => 'BOUVEN',
            'window', 'windows', 'jendela' => 'WINDOW',
            'lainnya', 'manual', 'other' => 'LAINNYA',
            default => null,
        };
    }

    public static function modelToSlug(string $model): string
    {
        return strtolower(str_replace(' ', '_', trim($model)));
    }

    public static function modelFromSlug(string $slug): string
    {
        return strtoupper(str_replace('-', '_', trim($slug)));
    }

    public static function modelHref(?string $category, ?string $model): ?string
    {
        if (! filled($category) || ! filled($model)) {
            return null;
        }

        return route('installation.model', [
            'category' => self::categoryToSlug($category),
            'model' => self::modelToSlug($model),
        ], absolute: false);
    }

    /**
     * @return list<int>
     */
    public static function parseSlots(?string $raw): array
    {
        if (! filled($raw)) {
            return [];
        }

        return Collection::make(preg_split('/[,\s]+/', (string) $raw) ?: [])
            ->map(fn ($v) => (int) $v)
            ->filter(fn (int $n) => $n >= 1 && $n <= 9)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return Collection<int, ProductMedia>
     */
    protected static function installationMediaWithProduct(): Collection
    {
        return ProductMedia::query()
            ->installation()
            ->visible()
            ->with(['product:id,parent_sku,name,short_name,product_category,product_model,status'])
            ->orderByDesc('id')
            ->get()
            ->filter(function (ProductMedia $item) {
                $product = $item->product;
                if (! $product instanceof Product || $product->status !== 'active') {
                    return false;
                }

                return filled($product->parent_sku)
                    && filled($product->product_category)
                    && filled($product->product_model);
            })
            ->values();
    }

    /**
     * @param  Collection<int, ProductMedia>  $media
     * @return list<array{id: string, image_url: string, label: string, product_count: int, photo_count: int, video_count: int, category: string|null, model: string|null, source: string, product_sku: string|null, href: string|null}>
     */
    protected static function productCardsFromMedia(Collection $media, int $limit): array
    {
        $cards = [];
        foreach ($media->groupBy('product_id') as $productId => $group) {
            /** @var Collection<int, ProductMedia> $group */
            $product = $group->first()?->product;
            if (! $product instanceof Product || ! filled($product->parent_sku)) {
                continue;
            }

            $stats = self::countMedia($group);
            if ($stats['cover'] === null) {
                continue;
            }

            $cards[] = [
                'id' => 'product-'.$product->id,
                'image_url' => $stats['cover'],
                'label' => self::productInstallationLabel($product),
                'product_count' => 1,
                'photo_count' => $stats['photo_count'],
                'video_count' => $stats['video_count'],
                'category' => $product->product_category ? strtoupper((string) $product->product_category) : null,
                'model' => $product->product_model ? strtoupper((string) $product->product_model) : null,
                'source' => 'import',
                'product_sku' => $product->parent_sku,
                'href' => route('installation.show', ['parent_sku' => $product->parent_sku], absolute: false),
                'product_href' => route('product.show', ['parent_sku' => $product->parent_sku], absolute: false),
            ];

            if (count($cards) >= $limit) {
                break;
            }
        }

        return array_values($cards);
    }

    /**
     * @param  Collection<int, ProductMedia>  $group
     * @return array{photo_count: int, video_count: int, cover: string|null}
     */
    protected static function countMedia(Collection $group): array
    {
        $photoCount = 0;
        $videoCount = 0;
        $coverUrl = null;

        foreach ($group as $item) {
            /** @var ProductMedia $item */
            $isVideo = self::isVideoMedia($item);
            if ($isVideo) {
                $videoCount++;
            } else {
                $photoCount++;
            }

            $url = $item->urlFor('card')
                ?? $item->urlFor('thumb')
                ?? (config('media.allow_source_url_fallback') ? $item->source_url : null);

            if (filled($url) && $coverUrl === null && ! $isVideo) {
                $coverUrl = $url;
            }
        }

        if ($coverUrl === null) {
            foreach ($group as $item) {
                /** @var ProductMedia $item */
                $url = $item->urlFor('card')
                    ?? $item->urlFor('thumb')
                    ?? (config('media.allow_source_url_fallback') ? $item->source_url : null);
                if (filled($url)) {
                    $coverUrl = $url;
                    break;
                }
            }
        }

        return [
            'photo_count' => $photoCount,
            'video_count' => $videoCount,
            'cover' => $coverUrl,
        ];
    }

    /**
     * @param  list<string|int>  $keys
     * @return list<string>
     */
    protected static function orderedPairKeys(array $keys): array
    {
        $categoryOrder = ['WINDOW', 'DOOR', 'BOUVEN'];
        $modelOrder = CatalogLabels::MODEL_ORDER;

        usort($keys, function ($a, $b) use ($categoryOrder, $modelOrder) {
            [$catA, $modelA] = array_pad(explode('|', (string) $a, 2), 2, '');
            [$catB, $modelB] = array_pad(explode('|', (string) $b, 2), 2, '');

            $catAIdx = array_search($catA, $categoryOrder, true);
            $catBIdx = array_search($catB, $categoryOrder, true);
            $catCmp = ($catAIdx === false ? 99 : $catAIdx) <=> ($catBIdx === false ? 99 : $catBIdx);
            if ($catCmp !== 0) {
                return $catCmp;
            }

            $modelAIdx = array_search($modelA, $modelOrder, true);
            $modelBIdx = array_search($modelB, $modelOrder, true);

            return ($modelAIdx === false ? 99 : $modelAIdx) <=> ($modelBIdx === false ? 99 : $modelBIdx);
        });

        return array_values(array_map('strval', $keys));
    }

    /**
     * @return list<array{id: string, image_url: string, label: string, product_count: int, photo_count: int, video_count: int, category: string, model: string, source: string, product_sku: null, href: string}>
     */
    protected static function manualModelFallback(int $limit): array
    {
        if ($limit < 1) {
            return [];
        }

        $items = CmsGalleryItem::query()
            ->where('published', true)
            ->whereNotNull('image_url')
            ->where('image_url', '!=', '')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->limit(48)
            ->get();

        if ($items->isEmpty()) {
            return [];
        }

        return [[
            'id' => 'model-manual-lainnya',
            'image_url' => (string) $items->first()->image_url,
            'label' => 'Dokumentasi lainnya',
            'product_count' => $items->count(),
            'photo_count' => $items->count(),
            'video_count' => 0,
            'category' => 'LAINNYA',
            'model' => 'MANUAL',
            'source' => 'manual',
            'product_sku' => null,
            'href' => route('installation.model', [
                'category' => 'lainnya',
                'model' => 'manual',
            ], absolute: false),
        ]];
    }

    /**
     * @return list<array{id: string, image_url: string, label: string, product_count: int, photo_count: int, video_count: int, category: string, model: string, source: string, product_sku: null, href: string}>
     */
    public static function manualProductCards(int $limit = 48): array
    {
        return CmsGalleryItem::query()
            ->where('published', true)
            ->whereNotNull('image_url')
            ->where('image_url', '!=', '')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (CmsGalleryItem $item) => [
                'id' => 'cms-'.$item->id,
                'image_url' => $item->image_url,
                'label' => $item->label ?: 'Hasil pemasangan',
                'product_count' => 1,
                'photo_count' => 1,
                'video_count' => 0,
                'category' => 'LAINNYA',
                'model' => 'MANUAL',
                'source' => 'manual',
                'product_sku' => null,
                'href' => $item->image_url,
            ])
            ->all();
    }

    private static function isVideoMedia(ProductMedia $item): bool
    {
        $mime = strtolower(trim((string) ($item->mime_type ?? '')));
        if ($mime !== '' && str_starts_with($mime, 'video/')) {
            return true;
        }

        $path = (string) ($item->stored_path ?? $item->source_url ?? '');

        return (bool) preg_match('/\.(mp4|webm|mov|m4v)(\?|$)/i', $path);
    }

    /** Label kartu produk di hasil pemasangan — ukuran + identitas model, bukan short_name saja. */
    protected static function productInstallationLabel(Product $product): string
    {
        $size = trim((string) ($product->short_name ?: ''));
        $line = trim(CatalogLabels::productLine(
            $product->product_category,
            $product->product_model,
            $product->design_variant,
        ));

        if ($size !== '' && $line !== '') {
            return $line.' · '.$size;
        }

        if ($size !== '') {
            return $size;
        }

        $name = trim((string) ($product->name ?: $product->parent_sku));

        return $name !== '' ? $name : 'Hasil pemasangan';
    }
}
