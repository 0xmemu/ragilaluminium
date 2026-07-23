<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Homepage layout + section copy on cms_pages.slug = beranda.
 *
 * content.layout.sections[] = { key, enabled, sort_order }
 * content.service_highlights = { title, subtitle, items[] }
 * content.how_to_order = { title, subtitle, steps[] }
 * content.auto_promotions preserved via HomepagePromotionSettings.
 */
class HomepageLayoutSettings
{
    public const PAGE_SLUG = 'beranda';

    public const SECTION_KEYS = ['banner', 'how_to_order'];

    /** @var list<array{key:string,enabled:bool,sort_order:int}> */
    public const DEFAULT_SECTIONS = [
        ['key' => 'banner', 'enabled' => true, 'sort_order' => 0],
        ['key' => 'how_to_order', 'enabled' => true, 'sort_order' => 1],
    ];

    public const SECTION_META = [
        'banner' => [
            'label' => 'Banner Utama',
            'description' => 'Kelola slide promo berputar di bagian atas beranda.',
            'icon' => 'images',
        ],
        'how_to_order' => [
            'label' => 'Cara Pesan Jendela Anda',
            'description' => 'Panduan langkah pemesanan di beranda.',
            'icon' => 'hand-coins',
        ],
    ];

    /** Legacy CMS payload only — tidak ditampilkan di beranda publik. */
    public const DEFAULT_SERVICE_HIGHLIGHTS = [
        'title' => 'Sorotan layanan',
        'subtitle' => 'Keunggulan yang membuat belanja aluminium lebih tenang.',
        'items' => [
            ['icon' => 'cod', 'title' => 'Bisa COD', 'description' => 'Bayar di tempat'],
            ['icon' => 'shield', 'title' => 'Garansi Resmi', 'description' => '1 Tahun Penuh'],
            ['icon' => 'truck', 'title' => 'Bebas Ongkir', 'description' => 'S&K Berlaku'],
        ],
    ];

    public const DEFAULT_HOW_TO_ORDER = [
        'title' => 'Cara pesan jendela Anda',
        'subtitle' => 'Alur singkat dari memilih model hingga pesanan terkirim.',
        'steps' => [
            ['title' => 'Pilih model', 'description' => 'Tentukan model jendela, pintu, atau bouven yang sesuai kebutuhan.'],
            ['title' => 'Pilih ukuran & varian', 'description' => 'Atur ukuran, desain, dan opsi di halaman produk.'],
            ['title' => 'Checkout', 'description' => 'Isi data pengiriman, pilih pembayaran, lalu buat pesanan.'],
            ['title' => 'Lacak pesanan', 'description' => 'Pantau status tanpa login lewat menu Pesanan.'],
        ],
    ];

    /**
     * @return array{
     *   sections: list<array{key:string,enabled:bool,sort_order:int}>,
     *   service_highlights: array{title:string,subtitle:string,items:list<array{icon:string,title:string,description:string}>},
     *   how_to_order: array{title:string,subtitle:string,steps:list<array{title:string,description:string}>}
     * }
     */
    public static function get(): array
    {
        $page = self::page();
        $content = is_array($page?->content) ? $page->content : [];

        return [
            'sections' => self::normalizeSections($content['layout']['sections'] ?? null),
            'service_highlights' => self::normalizeServiceHighlights($content['service_highlights'] ?? null),
            'how_to_order' => self::normalizeHowToOrder($content['how_to_order'] ?? null),
        ];
    }

    /**
     * @param  list<array{key:string,enabled:bool,sort_order:int}>  $sections
     * @return list<array{key:string,enabled:bool,sort_order:int,label:string,description:string,icon:string,edit_href:?string}>
     */
    public static function presentSections(array $sections): array
    {
        return array_map(function (array $section) {
            $meta = self::SECTION_META[$section['key']] ?? [
                'label' => $section['key'],
                'description' => '',
                'icon' => 'layout-grid',
            ];

            $editHref = match ($section['key']) {
                'banner' => route('admin.banners.index'),
                'how_to_order' => route('admin.beranda.how-to-order.edit'),
                default => null,
            };

            return [
                'key' => $section['key'],
                'enabled' => (bool) $section['enabled'],
                'sort_order' => (int) $section['sort_order'],
                'label' => $meta['label'],
                'description' => $meta['description'],
                'icon' => $meta['icon'],
                'edit_href' => $editHref,
            ];
        }, $sections);
    }

    /**
     * @param  list<array{key:string,enabled?:bool,sort_order?:int}>  $sections
     * @return list<array{key:string,enabled:bool,sort_order:int}>
     */
    public static function updateSections(array $sections, ?int $adminId = null): array
    {
        $normalized = self::normalizeSections($sections);
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $content['layout'] = [
            'sections' => array_map(fn (array $s) => [
                'key' => $s['key'],
                'enabled' => $s['enabled'],
                'sort_order' => $s['sort_order'],
            ], $normalized),
        ];
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return $normalized;
    }

    /**
     * Public storefront payload.
     *
     * @return array{
     *   sections: list<array{key:string,enabled:bool}>,
     *   service_highlights: array{title:string,subtitle:string,items:list<array{icon:string,title:string,description:string}>},
     *   how_to_order: array{title:string,subtitle:string,steps:list<array{title:string,description:string,step:string}>}
     * }
     */
    public static function forStorefront(): array
    {
        $data = self::get();
        $sections = collect($data['sections'])
            ->sortBy('sort_order')
            ->values()
            ->map(fn (array $section) => [
                'key' => $section['key'],
                'enabled' => (bool) $section['enabled'],
            ])
            ->all();

        $steps = [];
        foreach ($data['how_to_order']['steps'] as $index => $step) {
            $steps[] = [
                'step' => str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                'title' => $step['title'],
                'description' => $step['description'],
            ];
        }

        return [
            'sections' => $sections,
            'service_highlights' => $data['service_highlights'],
            'how_to_order' => [
                'title' => $data['how_to_order']['title'],
                'subtitle' => $data['how_to_order']['subtitle'],
                'steps' => $steps,
            ],
        ];
    }

    /**
     * @param  array{title?:string,subtitle?:string,items?:list<array{icon?:string,title?:string,description?:string}>}  $payload
     * @return array{title:string,subtitle:string,items:list<array{icon:string,title:string,description:string}>}
     */
    public static function updateServiceHighlights(array $payload, ?int $adminId = null): array
    {
        $normalized = self::normalizeServiceHighlights($payload);
        self::writeContentKey('service_highlights', $normalized, $adminId);

        return $normalized;
    }

    /**
     * @param  array{title?:string,subtitle?:string,steps?:list<array{title?:string,description?:string}>}  $payload
     * @return array{title:string,subtitle:string,steps:list<array{title:string,description:string}>}
     */
    public static function updateHowToOrder(array $payload, ?int $adminId = null): array
    {
        $normalized = self::normalizeHowToOrder($payload);
        self::writeContentKey('how_to_order', $normalized, $adminId);

        return $normalized;
    }

    /**
     * Preserve layout/section keys when generic CMS editor updates beranda.
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

        foreach (['layout', 'service_highlights', 'how_to_order', 'auto_promotions'] as $key) {
            $existing = $page?->content[$key] ?? null;
            if ($existing !== null && ! array_key_exists($key, $content)) {
                $content[$key] = $existing;
            }
        }

        return $content;
    }

    /**
     * @param  mixed  $raw
     * @return list<array{key:string,enabled:bool,sort_order:int}>
     */
    public static function normalizeSections(mixed $raw): array
    {
        $byKey = [];
        if (is_array($raw)) {
            foreach ($raw as $index => $row) {
                if (! is_array($row)) {
                    continue;
                }
                $key = (string) ($row['key'] ?? '');
                if (! in_array($key, self::SECTION_KEYS, true)) {
                    continue;
                }
                $byKey[$key] = [
                    'key' => $key,
                    'enabled' => array_key_exists('enabled', $row) ? (bool) $row['enabled'] : true,
                    'sort_order' => (int) ($row['sort_order'] ?? $index),
                ];
            }
        }

        $sections = [];
        foreach (self::DEFAULT_SECTIONS as $default) {
            $sections[] = $byKey[$default['key']] ?? $default;
        }

        usort($sections, fn ($a, $b) => $a['sort_order'] <=> $b['sort_order']);
        foreach ($sections as $index => &$section) {
            $section['sort_order'] = $index;
        }
        unset($section);

        return $sections;
    }

    /**
     * @param  mixed  $raw
     * @return array{title:string,subtitle:string,items:list<array{icon:string,title:string,description:string}>}
     */
    public static function normalizeServiceHighlights(mixed $raw): array
    {
        $raw = is_array($raw) ? $raw : [];
        $items = [];
        foreach (array_slice(is_array($raw['items'] ?? null) ? $raw['items'] : self::DEFAULT_SERVICE_HIGHLIGHTS['items'], 0, 8) as $item) {
            if (! is_array($item)) {
                continue;
            }
            $title = trim((string) ($item['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $items[] = [
                'icon' => self::normalizeIcon((string) ($item['icon'] ?? 'check')),
                'title' => mb_substr($title, 0, 80),
                'description' => mb_substr(trim((string) ($item['description'] ?? '')), 0, 160),
            ];
        }

        if ($items === []) {
            $items = self::DEFAULT_SERVICE_HIGHLIGHTS['items'];
        }

        return [
            'title' => mb_substr(trim((string) ($raw['title'] ?? self::DEFAULT_SERVICE_HIGHLIGHTS['title'])), 0, 120) ?: self::DEFAULT_SERVICE_HIGHLIGHTS['title'],
            'subtitle' => mb_substr(trim((string) ($raw['subtitle'] ?? self::DEFAULT_SERVICE_HIGHLIGHTS['subtitle'])), 0, 240),
            'items' => $items,
        ];
    }

    /**
     * @param  mixed  $raw
     * @return array{title:string,subtitle:string,steps:list<array{title:string,description:string}>}
     */
    public static function normalizeHowToOrder(mixed $raw): array
    {
        $raw = is_array($raw) ? $raw : [];
        $steps = [];
        foreach (array_slice(is_array($raw['steps'] ?? null) ? $raw['steps'] : self::DEFAULT_HOW_TO_ORDER['steps'], 0, 8) as $step) {
            if (! is_array($step)) {
                continue;
            }
            $title = trim((string) ($step['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $steps[] = [
                'title' => mb_substr($title, 0, 80),
                'description' => mb_substr(trim((string) ($step['description'] ?? '')), 0, 400),
            ];
        }

        if ($steps === []) {
            $steps = self::DEFAULT_HOW_TO_ORDER['steps'];
        }

        return [
            'title' => mb_substr(trim((string) ($raw['title'] ?? self::DEFAULT_HOW_TO_ORDER['title'])), 0, 120) ?: self::DEFAULT_HOW_TO_ORDER['title'],
            'subtitle' => mb_substr(trim((string) ($raw['subtitle'] ?? self::DEFAULT_HOW_TO_ORDER['subtitle'])), 0, 240),
            'steps' => $steps,
        ];
    }

    public static function normalizeIcon(string $icon): string
    {
        $allowed = ['cod', 'shield', 'truck', 'check', 'package', 'star', 'whatsapp'];

        return in_array($icon, $allowed, true) ? $icon : 'check';
    }

    /** @param  array<string, mixed>  $value */
    protected static function writeContentKey(string $key, array $value, ?int $adminId): void
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $content[$key] = $value;
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();
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
                'auto_promotions' => HomepagePromotionSettings::DEFAULTS,
                'layout' => [
                    'sections' => array_map(fn (array $s) => [
                        'key' => $s['key'],
                        'enabled' => $s['enabled'],
                        'sort_order' => $s['sort_order'],
                    ], self::DEFAULT_SECTIONS),
                ],
                'service_highlights' => self::DEFAULT_SERVICE_HIGHLIGHTS,
                'how_to_order' => self::DEFAULT_HOW_TO_ORDER,
            ],
            'published' => true,
        ]);
    }
}
