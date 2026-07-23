<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Public “Cara Pemesanan” page content on cms_pages.slug = cara-pemesanan.
 *
 * content.heading / content.subtitle — hero
 * content.body — HTML/plain notes (stage-9a CaraPemesananEditor)
 * content.steps[] — { icon, title, description, points[] }
 * content.info_cards[] — { icon, title, description }
 */
class CaraPemesananSettings
{
    public const PAGE_SLUG = 'cara-pemesanan';

    public const ICONS = [
        'search', 'ruler', 'credit-card', 'truck', 'shield-check',
        'package', 'check', 'whatsapp', 'hand-coins', 'star',
    ];

    public const DEFAULT_HEADING = 'Cara pesan jendela Anda';

    public const DEFAULT_SUBTITLE = 'Alur ringkas dan aman, dari memilih model hingga pesanan tiba di lokasi Anda.';

    /** @var list<array{icon:string,title:string,description:string,points:list<string>}> */
    public const DEFAULT_STEPS = [
        [
            'icon' => 'search',
            'title' => 'Pilih model & produk',
            'description' => 'Telusuri katalog jendela, pintu, dan bouven aluminium. Bandingkan model, desain, dan harga sebelum menentukan pilihan.',
            'points' => ['Filter berdasarkan kategori & harga', 'Lihat detail material dan foto produk'],
        ],
        [
            'icon' => 'ruler',
            'title' => 'Tentukan ukuran & varian',
            'description' => 'Atur ukuran, warna, jenis kaca, dan opsi lain langsung di halaman produk agar sesuai bukaan bangunan Anda.',
            'points' => ['Sesuaikan ukuran dengan kebutuhan', 'Ragu ukuran? Tim kami bantu konfirmasi'],
        ],
        [
            'icon' => 'credit-card',
            'title' => 'Checkout & pembayaran',
            'description' => 'Isi data pengiriman lengkap (provinsi hingga desa), pilih metode pembayaran, lalu buat pesanan.',
            'points' => ['Pembayaran COD atau Transfer Bank', 'Opsi lain diproses manual via WhatsApp'],
        ],
        [
            'icon' => 'truck',
            'title' => 'Produksi & pengiriman',
            'description' => 'Pesanan diproduksi dengan presisi, dikemas aman, lalu dikirim ke seluruh Indonesia. Pantau status tanpa perlu login.',
            'points' => ['Packing standar industri', 'Lacak status lewat menu Pesanan'],
        ],
    ];

    /** @var list<array{icon:string,title:string,description:string}> */
    public const DEFAULT_INFO_CARDS = [
        [
            'icon' => 'credit-card',
            'title' => 'Metode pembayaran',
            'description' => 'Tersedia COD dan Transfer Bank di checkout. Butuh metode lain? Tim kami bantu proses manual lewat WhatsApp.',
        ],
        [
            'icon' => 'truck',
            'title' => 'Pengiriman J&T',
            'description' => 'Pengiriman ke seluruh Indonesia dengan pengemasan aman. Status pengiriman diperbarui otomatis di halaman pesanan.',
        ],
        [
            'icon' => 'shield-check',
            'title' => 'Garansi & bantuan',
            'description' => 'Layanan purna jual dengan panduan instalasi. Ada kendala? Chat WhatsApp, kami bantu sampai jelas.',
        ],
    ];

    /**
     * @return array{
     *   title: string,
     *   published: bool,
     *   heading: string,
     *   subtitle: string,
     *   body: string,
     *   steps: list<array{icon:string,title:string,description:string,points:list<string>}>,
     *   info_cards: list<array{icon:string,title:string,description:string}>
     * }
     */
    public static function get(): array
    {
        $page = self::page();
        $content = is_array($page?->content) ? $page->content : [];

        return [
            'title' => $page?->title ?: 'Cara Pemesanan',
            'published' => (bool) ($page?->published ?? true),
            'heading' => self::normalizeHeading($content['heading'] ?? null),
            'subtitle' => self::normalizeSubtitle($content['subtitle'] ?? null),
            'body' => self::normalizeBody($content['body'] ?? $content['html'] ?? null),
            'steps' => self::normalizeSteps($content['steps'] ?? null),
            'info_cards' => self::normalizeInfoCards($content['info_cards'] ?? null),
        ];
    }

    /**
     * Storefront payload (always has steps/cards via defaults).
     *
     * @return array{
     *   heading: string,
     *   subtitle: string,
     *   body_html: string,
     *   steps: list<array{icon:string,title:string,description:string,points:list<string>}>,
     *   info_cards: list<array{icon:string,title:string,description:string}>
     * }
     */
    public static function forStorefront(): array
    {
        $data = self::get();

        return [
            'heading' => $data['heading'],
            'subtitle' => $data['subtitle'],
            'body_html' => self::bodyToHtml($data['body']),
            'steps' => $data['steps'],
            'info_cards' => $data['info_cards'],
        ];
    }

    /**
     * @param  array{
     *   title?: string,
     *   published?: bool,
     *   heading?: string,
     *   subtitle?: string,
     *   body?: string,
     *   steps?: list<array<string,mixed>>,
     *   info_cards?: list<array<string,mixed>>
     * }  $payload
     */
    public static function update(array $payload, ?int $adminId = null): array
    {
        $page = self::ensurePage();
        $existing = is_array($page->content) ? $page->content : [];

        $normalized = [
            'heading' => self::normalizeHeading($payload['heading'] ?? null),
            'subtitle' => self::normalizeSubtitle($payload['subtitle'] ?? null),
            'body' => self::normalizeBody($payload['body'] ?? null),
            'steps' => self::normalizeSteps($payload['steps'] ?? null, false),
            'info_cards' => self::normalizeInfoCards($payload['info_cards'] ?? null, false),
        ];

        $content = array_merge($existing, $normalized);
        // Drop legacy html key when body is managed here.
        unset($content['html']);

        $page->update([
            'title' => mb_substr(trim((string) ($payload['title'] ?? $page->title ?: 'Cara Pemesanan')), 0, 255) ?: 'Cara Pemesanan',
            'content' => $content,
            'published' => array_key_exists('published', $payload) ? (bool) $payload['published'] : $page->published,
            'updated_by_admin_id' => $adminId,
        ]);

        return self::get();
    }

    public static function pageId(): int
    {
        return (int) self::ensurePage()->id;
    }

    /**
     * Preserve structured keys when generic CMS editor touches this slug.
     *
     * @param  array<string, mixed>|null  $incoming
     * @return array<string, mixed>
     */
    public static function mergePreserving(?array $incoming, ?CmsPage $page): array
    {
        $content = is_array($incoming) ? $incoming : [];
        if (($page?->slug ?? null) !== self::PAGE_SLUG) {
            return $content;
        }

        foreach (['heading', 'subtitle', 'body', 'steps', 'info_cards'] as $key) {
            $existing = $page?->content[$key] ?? null;
            if ($existing !== null && ! array_key_exists($key, $content)) {
                $content[$key] = $existing;
            }
        }

        return $content;
    }

    protected static function page(): ?CmsPage
    {
        return CmsPage::query()->where('slug', self::PAGE_SLUG)->first();
    }

    protected static function ensurePage(): CmsPage
    {
        return CmsPage::query()->firstOrCreate(
            ['slug' => self::PAGE_SLUG],
            [
                'title' => 'Cara Pemesanan',
                'content' => [
                    'heading' => self::DEFAULT_HEADING,
                    'subtitle' => self::DEFAULT_SUBTITLE,
                    'body' => '',
                    'steps' => self::DEFAULT_STEPS,
                    'info_cards' => self::DEFAULT_INFO_CARDS,
                ],
                'published' => true,
            ],
        );
    }

    protected static function normalizeHeading(mixed $raw): string
    {
        $value = mb_substr(trim((string) ($raw ?? '')), 0, 120);

        return $value !== '' ? $value : self::DEFAULT_HEADING;
    }

    protected static function normalizeSubtitle(mixed $raw): string
    {
        return mb_substr(trim((string) ($raw ?? self::DEFAULT_SUBTITLE)), 0, 320);
    }

    protected static function normalizeBody(mixed $raw): string
    {
        return trim((string) ($raw ?? ''));
    }

    /**
     * @param  mixed  $raw
     * @return list<array{icon:string,title:string,description:string,points:list<string>}>
     */
    protected static function normalizeSteps(mixed $raw, bool $fallback = true): array
    {
        $steps = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 8) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }

            $points = [];
            $rawPoints = $row['points'] ?? [];
            if (is_string($rawPoints)) {
                $rawPoints = preg_split('/\r\n|\r|\n/', $rawPoints) ?: [];
            }
            if (is_array($rawPoints)) {
                foreach ($rawPoints as $point) {
                    $text = trim((string) $point);
                    if ($text !== '') {
                        $points[] = mb_substr($text, 0, 160);
                    }
                    if (count($points) >= 6) {
                        break;
                    }
                }
            }

            $steps[] = [
                'icon' => self::normalizeIcon((string) ($row['icon'] ?? 'check')),
                'title' => mb_substr($title, 0, 80),
                'description' => mb_substr(trim((string) ($row['description'] ?? '')), 0, 400),
                'points' => $points,
            ];
        }

        if ($steps === [] && $fallback) {
            return self::DEFAULT_STEPS;
        }

        return $steps;
    }

    /**
     * @param  mixed  $raw
     * @return list<array{icon:string,title:string,description:string}>
     */
    protected static function normalizeInfoCards(mixed $raw, bool $fallback = true): array
    {
        $cards = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 6) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $cards[] = [
                'icon' => self::normalizeIcon((string) ($row['icon'] ?? 'check')),
                'title' => mb_substr($title, 0, 80),
                'description' => mb_substr(trim((string) ($row['description'] ?? '')), 0, 320),
            ];
        }

        if ($cards === [] && $fallback) {
            return self::DEFAULT_INFO_CARDS;
        }

        return $cards;
    }

    protected static function normalizeIcon(string $icon): string
    {
        $icon = strtolower(trim($icon));

        return in_array($icon, self::ICONS, true) ? $icon : 'check';
    }

    protected static function bodyToHtml(string $body): string
    {
        $body = trim($body);
        if ($body === '') {
            return '';
        }

        if (preg_match('/<\/?[a-z][\s\S]*>/i', $body) === 1) {
            return strip_tags($body, '<p><br><strong><b><em><i><u><ul><ol><li><a><h2><h3><h4><blockquote>');
        }

        $escaped = e($body);
        $paragraphs = preg_split('/\n{2,}/', $escaped) ?: [];
        $html = [];
        foreach ($paragraphs as $paragraph) {
            $html[] = '<p>'.nl2br(trim($paragraph), false).'</p>';
        }

        return implode('', $html);
    }
}
