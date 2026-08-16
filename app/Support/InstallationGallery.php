<?php

namespace App\Support;

use App\Models\CmsGalleryItem;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Services\ModelProductService;
use Illuminate\Support\Collection;

/**
 * Public Hasil Pemasangan hierarchy:
 * 1) /hasil-pemasangan ??? kartu per model (total produk / foto / video)
 * 2) /hasil-pemasangan/{category}/{model} ??? kartu produk dalam model
 * 3) /hasil-pemasangan/{parent_sku} ??? galeri foto satu produk
 */
class InstallationGallery
{
    /**
     * One card per catalog model that has installation media or catalog products.
     * The order follows the active CMS model list.
     *
     * @return list<array{id: string, image_url: string|null, label: string, product_count: int, photo_count: int, video_count: int, category: string, model: string, source: string, product_sku: null, href: string}>
     */
    public static function modelCards(int $limit = 24): array
    {
        $media = self::installationMediaWithProduct();
        $grouped = $media->groupBy(
            fn (ProductMedia $item) => strtoupper((string) $item->product->product_category)
                .'|'.strtoupper((string) $item->product->product_model)
        );

        $catalogModels = app(ModelProductService::class)->storefrontCards();
        $cards = [];

        foreach ($catalogModels as $catalogModel) {
            $category = strtoupper((string) ($catalogModel['category'] ?? ''));
            $model = strtoupper((string) ($catalogModel['model'] ?? ''));
            if ($category === '' || $model === '') {
                continue;
            }

            $pairKey = $category.'|'.$model;
            $group = $grouped->get($pairKey);
            if (! $group instanceof Collection) {
                $group = collect();
            }

            $stats = $group->isNotEmpty()
                ? self::countMedia($group)
                : ['photo_count' => 0, 'video_count' => 0, 'cover' => null];

            $cover = $stats['cover'] ?? ($catalogModel['image'] ?? null);

            $cards[] = [
                'id' => 'model-'.$category.'-'.$model,
                'image_url' => $cover,
                'label' => (string) ($catalogModel['title'] ?? CatalogLabels::modelCardTitle($category, $model)),
                'product_count' => max(0, (int) ($catalogModel['count'] ?? 0)),
                'photo_count' => (int) $stats['photo_count'],
                'video_count' => $stats['video_count'],
                'category' => $category,
                'model' => $model,
                'source' => $group->isNotEmpty() ? 'import' : 'catalog',
                'product_sku' => null,
                'href' => route('installation.model', [
                    'category' => self::categoryToSlug($category),
                    'model' => self::modelToSlug($model),
                ], absolute: false),
            ];

            if ($limit > 0 && count($cards) >= $limit) {
                break;
            }
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

        if ($media->isNotEmpty()) {
            return self::productCardsFromMedia($media, $limit);
        }

        // Fallback: Product cards in this model from catalog
        return Product::visible()
            ->where('product_category', $category)
            ->where('product_model', $model)
            ->with(['mainImage', 'media'])
            ->limit($limit)
            ->get()
            ->map(function (Product $product) use ($category, $model) {
                $cover = $product->mainImage?->urlFor('card')
                    ?? $product->mainImage?->urlFor('thumb')
                    ?? ($product->media->first()?->urlFor('card'));

                return [
                    'id' => 'product-'.$product->id,
                    'image_url' => $cover,
                    'label' => self::productInstallationLabel($product),
                    'product_count' => 1,
                    'photo_count' => (int) $product->media->count(),
                    'video_count' => 0,
                    'category' => $category,
                    'model' => $model,
                    'source' => 'catalog',
                    'product_sku' => $product->parent_sku,
                    'href' => route('installation.show', ['parent_sku' => $product->parent_sku], absolute: false),
                    'product_href' => route('product.show', ['parent_sku' => $product->parent_sku], absolute: false),
                ];
            })
            ->all();
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
                    'href' => $item->image_url,
                    'product_href' => null,
                ])
                ->all();

            $cards = array_merge($cards, $manual);
        }

        return $cards;
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
     * Homepage carousel items: Kartu per model produk (bukan per produk / ukuran).
     *
     * @return list<array{id: string, image: string|null, label: string, product_count: int, photo_count: int, video_count: int, category: string|null, model: string|null, href: string, product_sku: null}>
     */
    public static function forHome(int $limit = 8): array
    {
        $models = collect(self::modelCards($limit));

        return $models
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'image' => $item['image_url'] ?? $item['image'] ?? null,
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
     * @return array{product: array{id: int, parent_sku: string, name: string, href: string, category: string|null, model: string|null}, media: list<array{id: int, url: string, thumb: string|null, is_video: bool}>}|null
     */
    public static function forProduct(Product $product): ?array
    {
        $media = ProductMedia::query()
            ->where('product_id', $product->id)
            ->visible()
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        if ($media->isEmpty()) {
            return null;
        }

        $items = $media->map(function (ProductMedia $m) {
            $url = $m->urlFor('card') ?? $m->urlFor('thumb') ?? '';

            return [
                'id' => $m->id,
                'url' => $url,
                'thumb' => $m->urlFor('thumb') ?? $url,
                'is_video' => self::isVideoMedia($m),
            ];
        })
            ->filter(fn (array $i) => filled($i['url']))
            ->values()
            ->all();

        if ($items === []) {
            return null;
        }

        return [
            'product' => [
                'id' => $product->id,
                'parent_sku' => (string) $product->parent_sku,
                'name' => (string) ($product->name ?: $product->parent_sku),
                'href' => route('product.show', ['parent_sku' => $product->parent_sku], absolute: false),
                'category' => $product->product_category ? strtoupper((string) $product->product_category) : null,
                'model' => $product->product_model ? strtoupper((string) $product->product_model) : null,
            ],
            'media' => $items,
        ];
    }

    /**
     * All media items for a model (photo + video grid on model page).
     *
     * @return list<array{id: int, url: string, thumb: string, is_video: bool, product_sku: string, product_name: string}>
     */
    public static function mediaForModel(string $category, string $model, int $limit = 60): array
    {
        $category = strtoupper(trim($category));
        $model = strtoupper(trim($model));

        return ProductMedia::query()
            ->visible()
            ->whereHas('product', fn ($q) => $q->visible()
                ->where('product_category', $category)
                ->where('product_model', $model))
            ->with(['product:id,parent_sku,name'])
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(function (ProductMedia $m) {
                $url = $m->urlFor('card') ?? $m->urlFor('thumb') ?? '';

                return [
                    'id' => $m->id,
                    'url' => $url,
                    'thumb' => $m->urlFor('thumb') ?? $url,
                    'is_video' => self::isVideoMedia($m),
                    'product_sku' => (string) ($m->product?->parent_sku ?? ''),
                    'product_name' => (string) ($m->product?->name ?? ''),
                ];
            })
            ->filter(fn (array $i) => filled($i['url']))
            ->values()
            ->all();
    }

    public static function categoryToSlug(string $category): string
    {
        return CategoryUrl::categoryToSlug($category);
    }

    public static function categoryFromSlug(string $slug): ?string
    {
        $code = CategoryUrl::categoryFromSlug($slug);
        if ($code !== null) {
            return $code;
        }

        // Kategori pseudo untuk media unggahan manual pada hierarki hasil pemasangan.
        return match (strtolower(trim($slug))) {
            'lainnya', 'manual', 'other' => 'LAINNYA',
            default => null,
        };
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

    public static function modelToSlug(string $model): string
    {
        return strtolower(str_replace('_', '-', trim($model)));
    }

    public static function modelFromSlug(string $slug): string
    {
        return strtoupper(str_replace('-', '_', trim($slug)));
    }

    /**
     * Parse catalog installation slot list such as 1,3,5.
     *
     * @return list<int>
     */
    public static function parseSlots(?string $raw): array
    {
        if (! filled($raw)) {
            return [];
        }

        return Collection::make(preg_split('/[,\\s]+/', (string) $raw) ?: [])
            ->map(fn ($value) => (int) $value)
            ->filter(fn (int $number): bool => $number >= 1 && $number <= 9)
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
                    && filled($product->product_model)
                    && ($item->urlFor('card') !== null || $item->urlFor('thumb') !== null);
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
                ?? $item->urlFor('thumb');

            if (filled($url) && $coverUrl === null && ! $isVideo) {
                $coverUrl = $url;
            }
        }

        if ($coverUrl === null) {
            foreach ($group as $item) {
                /** @var ProductMedia $item */
                $url = $item->urlFor('card')
                    ?? $item->urlFor('thumb');
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

    public static function isVideoMedia(ProductMedia $item): bool
    {
        $mime = strtolower(trim((string) ($item->mime_type ?? '')));
        if ($mime !== '' && str_starts_with($mime, 'video/')) {
            return true;
        }

        $path = (string) ($item->stored_path ?? $item->source_url ?? '');

        return (bool) preg_match('/\.(mp4|webm|mov|m4v)(\?|$)/i', $path);
    }

    /** Label kartu produk di hasil pemasangan: ukuran + identitas model. */
    protected static function productInstallationLabel(Product $product): string
    {
        $size = trim((string) ($product->short_name ?: ''));
        $line = trim(CatalogLabels::productLine(
            $product->product_category,
            $product->product_model,
            $product->design_variant,
        ));

        if ($size !== '' && $line !== '') {
            return $line.' - '.$size;
        }

        if ($size !== '') {
            return $size;
        }

        $name = trim((string) ($product->name ?: $product->parent_sku));

        return $name !== '' ? $name : 'Hasil pemasangan';
    }
}

