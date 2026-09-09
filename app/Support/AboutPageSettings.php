<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Halaman "Tentang Kami" (cms_pages slug tentang-kami) memakai form terstruktur:
 * admin hanya mengisi ISI (teks), STYLE tetap milik komponen React Public/About.
 *
 * content.hero_title     - judul hero (fallback: kode)
 * content.hero_tagline   - satu kalimat di bawah judul hero
 * content.why_points[]   - { icon, title, body } (maks 6)
 * content.work_steps[]   - { title, body } (maks 4)
 * content.trust_rows[]   - list<string> (maks 6)
 *
 * Kosong di DB = fallback ke teks baku di kode. Halaman tidak pernah rusak.
 */
class AboutPageSettings
{
    public const PAGE_SLUG = 'tentang-kami';

    /** Ikon resmi yang boleh dipakai admin (terdaftar di iconRegistry). */
    public const ICONS = [
        'storefront', 'ruler', 'package', 'check-circle', 'headset',
        'hand-coins', 'truck', 'shield-check', 'star', 'sparkle',
        'clock', 'users', 'wrench', 'whatsapp',
    ];

    /** @var list<array{icon:string,title:string,body:string}> */
    public const DEFAULT_WHY_POINTS = [
        [
            'icon' => 'storefront',
            'title' => 'Produksi sendiri',
            'body' => 'Dibuat di workshop kami dengan kontrol kualitas langsung.',
        ],
        [
            'icon' => 'ruler',
            'title' => 'Bisa custom',
            'body' => 'Ukuran dan model dapat disesuaikan dengan kebutuhan proyek.',
        ],
        [
            'icon' => 'package',
            'title' => 'Packing aman',
            'body' => 'Pengiriman menggunakan packing kayu untuk menjaga produk.',
        ],
        [
            'icon' => 'check-circle',
            'title' => 'Proses jelas',
            'body' => 'Pesanan dikonfirmasi sebelum diproses dan dikirim.',
        ],
    ];

    /** @var list<array{title:string,body:string}> */
    public const DEFAULT_WORK_STEPS = [
        ['title' => 'Konsultasi', 'body' => 'Tentukan model, ukuran, warna, dan kebutuhan kaca.'],
        ['title' => 'Produksi', 'body' => 'Produk dibuat di workshop dengan pemeriksaan kualitas.'],
        ['title' => 'Packing & Kirim', 'body' => 'Produk dikemas aman lalu dikirim sesuai jadwal.'],
    ];

    /** @var list<string> */
    public const DEFAULT_TRUST_ROWS = [
        'Melayani pengiriman ke seluruh Indonesia',
        'Bisa konsultasi sebelum pesan',
        'Ada konfirmasi detail sebelum produksi',
        'Ada kebijakan penggantian jika produk bermasalah',
    ];

    public static function ensurePage(): CmsPage
    {
        return CmsPage::query()->firstOrCreate(
            ['slug' => self::PAGE_SLUG],
            [
                'title' => 'Tentang Kami',
                'content' => [],
                'published' => true,
            ],
        );
    }

    public static function pageId(): int
    {
        return (int) self::ensurePage()->id;
    }

    /**
     * Payload untuk form admin: nilai tersimpan (boleh kosong).
     *
     * @return array{hero_title:string,hero_tagline:string,why_points:list<array{icon:string,title:string,body:string}>,work_steps:list<array{title:string,body:string}>,trust_rows:list<string>}
     */
    public static function getForAdmin(): array
    {
        $content = self::rawContent();

        return [
            'hero_title' => (string) ($content['hero_title'] ?? ''),
            'hero_tagline' => (string) ($content['hero_tagline'] ?? ''),
            'why_points' => self::normalizeWhyPoints($content['why_points'] ?? null, fallback: false),
            'work_steps' => self::normalizeWorkSteps($content['work_steps'] ?? null, fallback: false),
            'trust_rows' => self::normalizeTrustRows($content['trust_rows'] ?? null, fallback: false),
        ];
    }

    /**
     * Payload untuk storefront: selalu terisi (fallback ke default baku).
     *
     * @return array{hero_title:string,hero_tagline:string,why_points:list<array{icon:string,title:string,body:string}>,work_steps:list<array{title:string,body:string}>,trust_rows:list<string>}
     */
    public static function forStorefront(): array
    {
        $content = self::rawContent();

        return [
            'hero_title' => self::normalizeHeroTitle($content['hero_title'] ?? null),
            'hero_tagline' => self::normalizeHeroTagline($content['hero_tagline'] ?? null),
            'why_points' => self::normalizeWhyPoints($content['why_points'] ?? null),
            'work_steps' => self::normalizeWorkSteps($content['work_steps'] ?? null),
            'trust_rows' => self::normalizeTrustRows($content['trust_rows'] ?? null),
        ];
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    public static function update(array $payload, ?int $adminId = null): void
    {
        $page = self::ensurePage();

        $content = [
            'hero_title' => trim((string) ($payload['hero_title'] ?? '')),
            'hero_tagline' => mb_substr(trim((string) ($payload['hero_tagline'] ?? '')), 0, 320),
            'why_points' => self::normalizeWhyPoints($payload['why_points'] ?? null, fallback: false),
            'work_steps' => self::normalizeWorkSteps($payload['work_steps'] ?? null, fallback: false),
            'trust_rows' => self::normalizeTrustRows($payload['trust_rows'] ?? null, fallback: false),
        ];

        $page->update([
            'content' => $content,
            'updated_by_admin_id' => $adminId,
        ]);

        // Legacy keys dihapus supaya tidak ada dua sumber konten untuk About.
        $page->refresh();
        if (is_array($page->content) && (isset($page->content['body']) || isset($page->content['html']) || isset($page->content['heading']))) {
            $cleaned = $page->content;
            unset($cleaned['body'], $cleaned['html'], $cleaned['heading']);
            $page->update(['content' => $cleaned]);
        }
    }

    /** @return array<string,mixed> */
    protected static function rawContent(): array
    {
        $page = CmsPage::query()->where('slug', self::PAGE_SLUG)->first();
        $content = $page && is_array($page->content) ? $page->content : [];

        return $content;
    }

    protected static function normalizeHeroTitle(mixed $raw): string
    {
        $value = trim((string) ($raw ?? ''));

        return $value !== '' ? $value : 'Tentang Kami';
    }

    protected static function normalizeHeroTagline(mixed $raw): string
    {
        return trim((string) ($raw ?? ''));
    }

    /**
     * @return list<array{icon:string,title:string,body:string}>
     */
    protected static function normalizeWhyPoints(mixed $raw, bool $fallback = true): array
    {
        $points = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 6) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $points[] = [
                'icon' => self::normalizeIcon((string) ($row['icon'] ?? 'check-circle')),
                'title' => mb_substr($title, 0, 60),
                'body' => mb_substr(trim((string) ($row['body'] ?? '')), 0, 200),
            ];
        }

        if ($points === [] && $fallback) {
            return self::DEFAULT_WHY_POINTS;
        }

        return $points;
    }

    /**
     * @return list<array{title:string,body:string}>
     */
    protected static function normalizeWorkSteps(mixed $raw, bool $fallback = true): array
    {
        $steps = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 4) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $steps[] = [
                'title' => mb_substr($title, 0, 60),
                'body' => mb_substr(trim((string) ($row['body'] ?? '')), 0, 200),
            ];
        }

        if ($steps === [] && $fallback) {
            return self::DEFAULT_WORK_STEPS;
        }

        return $steps;
    }

    /**
     * @return list<string>
     */
    protected static function normalizeTrustRows(mixed $raw, bool $fallback = true): array
    {
        $rows = [];
        $source = is_array($raw)
            ? $raw
            : (is_string($raw) ? preg_split('/\r\n|\r|\n/', $raw) ?: [] : []);

        foreach (array_slice($source, 0, 6) as $row) {
            $text = trim((string) $row);
            if ($text !== '') {
                $rows[] = mb_substr($text, 0, 120);
            }
        }

        if ($rows === [] && $fallback) {
            return self::DEFAULT_TRUST_ROWS;
        }

        return $rows;
    }

    protected static function normalizeIcon(string $icon): string
    {
        $icon = strtolower(trim($icon));

        return in_array($icon, self::ICONS, true) ? $icon : 'check-circle';
    }
}
