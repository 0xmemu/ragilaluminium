<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Meta for cms_pages.slug = testimoni (Apa Kata Pelanggan / /reviews hero).
 */
class TestimonialPageSettings
{
    public const PAGE_SLUG = 'testimoni';

    public const DEFAULT_TITLE = 'Testimoni & Ulasan';

    public const DEFAULT_HEADING = 'Apa kata pelanggan kami.';

    public const DEFAULT_SUBTITLE = 'Ulasan pelanggan dan dokumentasi pemasangan dari data publikasi toko.';

    public static function ensurePage(): CmsPage
    {
        return CmsPage::query()->firstOrCreate(
            ['slug' => self::PAGE_SLUG],
            [
                'title' => self::DEFAULT_TITLE,
                'content' => [
                    'heading' => self::DEFAULT_HEADING,
                    'subtitle' => self::DEFAULT_SUBTITLE,
                ],
                'published' => true,
            ],
        );
    }

    public static function pageId(): int
    {
        return (int) self::ensurePage()->id;
    }

    /**
     * @return array{title:string,heading:string,subtitle:string,published:bool}
     */
    public static function pageMeta(): array
    {
        $page = self::ensurePage();
        $content = is_array($page->content) ? $page->content : [];

        return [
            'title' => $page->title ?: self::DEFAULT_TITLE,
            'heading' => trim((string) ($content['heading'] ?? '')) ?: self::DEFAULT_HEADING,
            'subtitle' => trim((string) ($content['subtitle'] ?? '')) ?: self::DEFAULT_SUBTITLE,
            'published' => (bool) $page->published,
        ];
    }

    /**
     * @param  array{title?:string,heading?:string,subtitle?:string,published?:bool}  $payload
     */
    public static function updatePageMeta(array $payload, ?int $adminId = null): void
    {
        $page = self::ensurePage();
        $content = is_array($page->content) ? $page->content : [];
        $content['heading'] = mb_substr(trim((string) ($payload['heading'] ?? $content['heading'] ?? self::DEFAULT_HEADING)), 0, 120) ?: self::DEFAULT_HEADING;
        $content['subtitle'] = mb_substr(trim((string) ($payload['subtitle'] ?? $content['subtitle'] ?? '')), 0, 320);

        $page->update([
            'title' => mb_substr(trim((string) ($payload['title'] ?? $page->title)), 0, 255) ?: self::DEFAULT_TITLE,
            'content' => $content,
            'published' => array_key_exists('published', $payload) ? (bool) $payload['published'] : $page->published,
            'updated_by_admin_id' => $adminId,
        ]);
    }

    /**
     * @return array{title:string,heading:string,subtitle:string}
     */
    public static function forStorefront(): array
    {
        $meta = self::pageMeta();

        return [
            'title' => $meta['title'],
            'heading' => $meta['heading'],
            'subtitle' => $meta['subtitle'],
        ];
    }
}
