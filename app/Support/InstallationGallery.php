<?php

namespace App\Support;

use App\Models\CmsGalleryItem;
use App\Models\Product;
use App\Models\ProductMedia;
use Illuminate\Support\Collection;

/**
 * Public Hasil Pemasangan = imported product_media (is_installation) ∪ manual cms_gallery_items.
 * Listing cards are per-product; detail gallery is /hasil-pemasangan/{parent_sku}.
 */
class InstallationGallery
{
    /**
     * One card per product that has installation media (plus leftover manual CMS cards).
     *
     * @return list<array{id: string, image_url: string, label: string, photo_count: int, video_count: int, source: string, product_sku: string|null, href: string|null}>
     */
    public static function productCards(int $limit = 24): array
    {
        $media = ProductMedia::query()
            ->installation()
            ->visible()
            ->with(['product:id,parent_sku,name,short_name'])
            ->orderByDesc('id')
            ->get();

        $cards = [];
        foreach ($media->groupBy('product_id') as $productId => $group) {
            /** @var Collection<int, ProductMedia> $group */
            $product = $group->first()?->product;
            if (! $product instanceof Product || ! filled($product->parent_sku)) {
                continue;
            }

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

            if ($coverUrl === null) {
                continue;
            }

            $label = trim((string) ($product->short_name ?: $product->name ?: $product->parent_sku));

            $cards[] = [
                'id' => 'product-'.$product->id,
                'image_url' => (string) $coverUrl,
                'label' => $label !== '' ? $label : 'Hasil pemasangan',
                'photo_count' => $photoCount,
                'video_count' => $videoCount,
                'source' => 'import',
                'product_sku' => $product->parent_sku,
                'href' => route('installation.show', ['parent_sku' => $product->parent_sku]),
            ];

            if (count($cards) >= $limit) {
                break;
            }
        }

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
                    'photo_count' => 1,
                    'video_count' => 0,
                    'source' => 'manual',
                    'product_sku' => null,
                    'href' => route('installation.index'),
                ])
                ->all();

            $cards = array_merge($cards, $manual);
        }

        return array_values($cards);
    }

    /**
     * @deprecated Use productCards(); kept for callers during transition.
     *
     * @return list<array{id: string, image_url: string, label: string, photo_count: int, video_count: int, source: string, product_sku: string|null, href: string|null}>
     */
    public static function items(int $limit = 24): array
    {
        return self::productCards($limit);
    }

    /**
     * Home strip shape (`image` + `href`).
     *
     * @return list<array{id: string, image: string, label: string, photo_count: int, video_count: int, href: string|null, product_sku: string|null}>
     */
    public static function forHome(int $limit = 8): array
    {
        return collect(self::productCards($limit))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'image' => $item['image_url'],
                'label' => $item['label'],
                'photo_count' => $item['photo_count'],
                'video_count' => $item['video_count'],
                'href' => $item['href'],
                'product_sku' => $item['product_sku'],
            ])
            ->all();
    }

    /**
     * Full installation gallery for one product (detail page).
     *
     * @return array{product: array{id: int, parent_sku: string, name: string, href: string}, media: list<array{id: int, url: string, thumb: string|null}>}|null
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
                'href' => route('product.show', ['parent_sku' => $product->parent_sku]),
            ],
            'media' => $media,
        ];
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

    private static function isVideoMedia(ProductMedia $item): bool
    {
        $mime = strtolower(trim((string) ($item->mime_type ?? '')));
        if ($mime !== '' && str_starts_with($mime, 'video/')) {
            return true;
        }

        $path = (string) ($item->stored_path ?? $item->source_url ?? '');

        return (bool) preg_match('/\.(mp4|webm|mov|m4v)(\?|$)/i', $path);
    }
}
