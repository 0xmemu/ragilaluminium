<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Long-form CMS documents on cms_pages (Informasi Toko, Ketentuan, Privasi).
 *
 * content.heading — optional hero label
 * content.body — HTML or plain text (stage-9a)
 */
class CmsDocumentSettings
{
    public const KEY_TENTANG_KAMI = 'tentang-kami';

    public const KEY_KETENTUAN = 'ketentuan-layanan';

    public const KEY_PRIVASI = 'kebijakan-privasi';

    /**
     * @var array<string, array{label:string,default_title:string,default_heading:string,public_route:string}>
     */
    public const DOCUMENTS = [
        self::KEY_TENTANG_KAMI => [
            'label' => 'Informasi Toko',
            'default_title' => 'Informasi Toko Ragil Aluminium',
            'default_heading' => 'Informasi Toko',
            'public_route' => 'about',
        ],
        self::KEY_KETENTUAN => [
            'label' => 'Ketentuan Layanan',
            'default_title' => 'Ketentuan Layanan',
            'default_heading' => 'Ketentuan Layanan',
            'public_route' => 'terms',
        ],
        self::KEY_PRIVASI => [
            'label' => 'Kebijakan Privasi',
            'default_title' => 'Kebijakan Privasi',
            'default_heading' => 'Kebijakan Privasi',
            'public_route' => 'privacy',
        ],
    ];

    public static function assertKey(string $key): void
    {
        if (! isset(self::DOCUMENTS[$key])) {
            throw new \InvalidArgumentException('Unknown CMS document key: '.$key);
        }
    }

    public static function ensurePage(string $key): CmsPage
    {
        self::assertKey($key);
        $meta = self::DOCUMENTS[$key];

        return CmsPage::query()->firstOrCreate(
            ['slug' => $key],
            [
                'title' => $meta['default_title'],
                'content' => [
                    'heading' => $meta['default_heading'],
                    'body' => '',
                ],
                'published' => true,
            ],
        );
    }

    public static function pageId(string $key): int
    {
        return (int) self::ensurePage($key)->id;
    }

    /**
     * @return array{title:string,heading:string,body:string,published:bool,slug:string,label:string}
     */
    public static function get(string $key): array
    {
        self::assertKey($key);
        $meta = self::DOCUMENTS[$key];
        $page = self::ensurePage($key);
        $content = is_array($page->content) ? $page->content : [];

        return [
            'slug' => $key,
            'label' => $meta['label'],
            'title' => $page->title ?: $meta['default_title'],
            'heading' => trim((string) ($content['heading'] ?? '')) ?: $meta['default_heading'],
            'body' => trim((string) ($content['body'] ?? $content['html'] ?? '')),
            'published' => (bool) $page->published,
        ];
    }

    /**
     * @return array{title:string,heading:string,body_html:string,slug:string}
     */
    public static function forStorefront(string $key): array
    {
        $data = self::get($key);

        return [
            'title' => $data['title'],
            'heading' => $data['heading'],
            'body_html' => self::bodyToHtml($data['body']),
            'slug' => $data['slug'],
        ];
    }

    /**
     * @param  array{title?:string,heading?:string,body?:string,published?:bool}  $payload
     * @return array{title:string,heading:string,body:string,published:bool,slug:string,label:string}
     */
    public static function update(string $key, array $payload, ?int $adminId = null): array
    {
        self::assertKey($key);
        $meta = self::DOCUMENTS[$key];
        $page = self::ensurePage($key);
        $existing = is_array($page->content) ? $page->content : [];

        $heading = mb_substr(trim((string) ($payload['heading'] ?? $existing['heading'] ?? $meta['default_heading'])), 0, 120) ?: $meta['default_heading'];
        $body = trim((string) ($payload['body'] ?? ''));

        $content = $existing;
        $content['heading'] = $heading;
        $content['body'] = $body;
        unset($content['html']);

        $page->update([
            'title' => mb_substr(trim((string) ($payload['title'] ?? $page->title ?: $meta['default_title'])), 0, 255) ?: $meta['default_title'],
            'content' => $content,
            'published' => array_key_exists('published', $payload) ? (bool) $payload['published'] : $page->published,
            'updated_by_admin_id' => $adminId,
        ]);

        return self::get($key);
    }

    /**
     * Preserve document keys when generic CMS editor touches these slugs.
     *
     * @param  array<string, mixed>|null  $incoming
     * @return array<string, mixed>
     */
    public static function mergePreserving(?array $incoming, ?CmsPage $page): array
    {
        $content = is_array($incoming) ? $incoming : [];
        $slug = $page?->slug;
        if (! $slug || ! isset(self::DOCUMENTS[$slug])) {
            return $content;
        }

        foreach (['heading', 'body'] as $key) {
            $existing = $page?->content[$key] ?? null;
            if ($existing !== null && ! array_key_exists($key, $content)) {
                $content[$key] = $existing;
            }
        }

        return $content;
    }

    public static function bodyToHtml(string $body): string
    {
        $body = trim($body);
        if ($body === '') {
            return '<p>Konten belum tersedia.</p>';
        }

        if (preg_match('/<\/?[a-z][\s\S]*>/i', $body) === 1) {
            $clean = strip_tags($body, '<p><br><strong><b><em><i><u><ul><ol><li><a><h2><h3><h4><blockquote>');

            return $clean !== '' ? $clean : '<p>Konten belum tersedia.</p>';
        }

        $escaped = e($body);
        $paragraphs = preg_split('/\n{2,}/', $escaped) ?: [];
        $html = [];
        foreach ($paragraphs as $paragraph) {
            $html[] = '<p>'.nl2br(trim($paragraph), false).'</p>';
        }

        return $html !== [] ? implode('', $html) : '<p>Konten belum tersedia.</p>';
    }
}
