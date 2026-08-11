<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Opsi tampilan bar promo (slide otomatis antar beberapa pengumuman).
 *
 * Disimpan di cms_pages.slug = announcement-bar → content.slide:
 * {
 *   enabled: bool,
 *   interval: int (detik)
 * }
 */
class AnnouncementSlideSettings
{
    public const PAGE_SLUG = 'announcement-bar';

    public const DEFAULTS = [
        'enabled' => false,
        'interval' => 5,
    ];

    /**
     * @return array{enabled: bool, interval: int}
     */
    public static function get(): array
    {
        $page = self::page();
        $stored = is_array($page?->content['slide'] ?? null) ? $page->content['slide'] : [];

        return [
            'enabled' => (bool) ($stored['enabled'] ?? self::DEFAULTS['enabled']),
            'interval' => (int) ($stored['interval'] ?? self::DEFAULTS['interval']),
        ];
    }

    /**
     * Payload untuk Inertia (admin + public).
     *
     * @return array{enabled: bool, interval: int}
     */
    public static function sharedProps(): array
    {
        return self::get();
    }

    /**
     * Simpan dari request admin.
     *
     * @param  array{enabled: bool, interval: int}  $data
     */
    public static function save(array $data): void
    {
        $page = self::page();
        $content = is_array($page?->content) ? $page->content : [];

        if ($page === null) {
            CmsPage::create([
                'slug' => self::PAGE_SLUG,
                'title' => 'Pengaturan Bar Promo',
                'content' => array_merge($content, ['slide' => $data]),
                'published' => true,
            ]);

            return;
        }

        $page->update([
            'content' => array_merge($content, ['slide' => $data]),
        ]);
    }

    private static function page(): ?CmsPage
    {
        return CmsPage::query()->where('slug', self::PAGE_SLUG)->first();
    }
}
