<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Homepage auto-promotion toggle stored on cms_pages.slug = beranda.
 *
 * content.auto_promotions = { enabled: bool, max_slides: int }
 */
class HomepagePromotionSettings
{
    public const PAGE_SLUG = 'beranda';

    public const DEFAULTS = [
        'enabled' => true,
        'max_slides' => 3,
    ];

    /**
     * @return array{enabled: bool, max_slides: int}
     */
    public static function get(): array
    {
        $page = self::page();
        $stored = is_array($page?->content['auto_promotions'] ?? null)
            ? $page->content['auto_promotions']
            : [];

        return [
            'enabled' => (bool) ($stored['enabled'] ?? self::DEFAULTS['enabled']),
            'max_slides' => max(1, min(8, (int) ($stored['max_slides'] ?? self::DEFAULTS['max_slides']))),
        ];
    }

    public static function enabled(): bool
    {
        return self::get()['enabled'];
    }

    public static function maxSlides(): int
    {
        return self::get()['max_slides'];
    }

    /**
     * @param  array{enabled?: bool, max_slides?: int}  $settings
     * @return array{enabled: bool, max_slides: int}
     */
    public static function update(array $settings, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $merged = array_merge(self::DEFAULTS, is_array($content['auto_promotions'] ?? null) ? $content['auto_promotions'] : []);

        if (array_key_exists('enabled', $settings)) {
            $merged['enabled'] = (bool) $settings['enabled'];
        }
        if (array_key_exists('max_slides', $settings)) {
            $merged['max_slides'] = max(1, min(8, (int) $settings['max_slides']));
        }

        $content['auto_promotions'] = $merged;
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return [
            'enabled' => (bool) $merged['enabled'],
            'max_slides' => (int) $merged['max_slides'],
        ];
    }

    /**
     * Preserve reserved auto_promotions when generic CMS editor updates beranda.
     *
     * @param  array<string, mixed>|null  $incoming
     * @return array<string, mixed>
     */
    public static function mergePreservingAutoPromotions(?array $incoming, ?CmsPage $page): array
    {
        $content = is_array($incoming) ? $incoming : [];
        if (($page?->slug ?? null) !== self::PAGE_SLUG) {
            return $content;
        }

        $existing = is_array($page?->content['auto_promotions'] ?? null)
            ? $page->content['auto_promotions']
            : null;

        if ($existing !== null && ! array_key_exists('auto_promotions', $content)) {
            $content['auto_promotions'] = $existing;
        }

        return $content;
    }

    private static function page(bool $create = false): ?CmsPage
    {
        $page = CmsPage::query()->where('slug', self::PAGE_SLUG)->first();
        if ($page || ! $create) {
            return $page;
        }

        return CmsPage::create([
            'slug' => self::PAGE_SLUG,
            'title' => 'Beranda',
            'content' => [
                'auto_promotions' => self::DEFAULTS,
            ],
            'published' => true,
        ]);
    }
}
