<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * External marketplace / social links for storefront.
 *
 * Catalog (key, label, channel, icon) lives in config/sitemap.php → platforms.
 * Admin overrides href on cms_pages.slug = storefront-platforms → content.links.
 */
class StorefrontPlatformSettings
{
    public const PAGE_SLUG = 'storefront-platforms';

    /**
     * @return list<string>
     */
    public static function allowedKeys(): array
    {
        return collect(config('sitemap.platforms', []))
            ->pluck('key')
            ->filter()
            ->values()
            ->all();
    }

    /**
     * Stored href map keyed by platform key. Empty / "#" = not set.
     *
     * @return array<string, string>
     */
    public static function linkMap(): array
    {
        $page = self::page();
        $stored = is_array($page?->content['links'] ?? null) ? $page->content['links'] : [];
        $map = [];

        foreach (self::allowedKeys() as $key) {
            $value = trim((string) ($stored[$key] ?? ''));
            $map[$key] = $value === '' || $value === '#' ? '' : $value;
        }

        return $map;
    }

    /**
     * Admin form payload: catalog + current href.
     *
     * @return list<array{key: string, label: string, channel: string, icon: string|null, href: string}>
     */
    public static function forAdmin(): array
    {
        $links = self::linkMap();

        return collect(config('sitemap.platforms', []))
            ->filter(fn ($row) => is_array($row) && filled($row['key'] ?? null))
            ->map(function (array $row) use ($links) {
                $key = (string) $row['key'];
                $configHref = trim((string) ($row['href'] ?? ''));
                $stored = $links[$key] ?? '';
                $href = $stored !== ''
                    ? $stored
                    : ($configHref !== '' && $configHref !== '#' ? $configHref : '');

                return [
                    'key' => $key,
                    'label' => (string) ($row['label'] ?? $key),
                    'channel' => in_array(($row['channel'] ?? ''), ['marketplace', 'social'], true)
                        ? $row['channel']
                        : (in_array($key, ['shopee', 'tokopedia', 'lazada', 'tiktok_shop'], true) ? 'marketplace' : 'social'),
                    'icon' => isset($row['icon']) ? (string) $row['icon'] : null,
                    'href' => $href,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Public Inertia share payload.
     *
     * @return list<array{key: string, label: string, href: string, icon: string|null, channel: string}>
     */
    public static function forStorefront(): array
    {
        return collect(self::forAdmin())
            ->map(fn (array $row) => [
                'key' => $row['key'],
                'label' => $row['label'],
                'href' => $row['href'] !== '' ? $row['href'] : '#',
                'icon' => $row['icon'],
                'channel' => $row['channel'],
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, string|null>  $links
     * @return list<array{key: string, label: string, channel: string, icon: string|null, href: string}>
     */
    public static function update(array $links, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $allowed = array_flip(self::allowedKeys());
        $normalized = [];

        foreach ($links as $key => $value) {
            $key = (string) $key;
            if (! isset($allowed[$key])) {
                continue;
            }
            $href = trim((string) ($value ?? ''));
            if ($href === '' || $href === '#') {
                $normalized[$key] = '';

                continue;
            }
            $normalized[$key] = mb_substr($href, 0, 500);
        }

        foreach (self::allowedKeys() as $key) {
            if (! array_key_exists($key, $normalized)) {
                $normalized[$key] = '';
            }
        }

        $content['links'] = $normalized;
        $page->content = $content;
        $page->title = $page->title ?: 'Marketplace & Media Sosial';
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return self::forAdmin();
    }

    protected static function page(bool $create = false): ?CmsPage
    {
        $query = CmsPage::query()->where('slug', self::PAGE_SLUG);

        if ($create) {
            return $query->firstOrCreate(
                ['slug' => self::PAGE_SLUG],
                [
                    'title' => 'Marketplace & Media Sosial',
                    'content' => ['links' => []],
                    'published' => true,
                ],
            );
        }

        return $query->first();
    }
}
