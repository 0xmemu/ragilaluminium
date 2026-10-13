<?php

namespace App\Support;

use App\Models\CmsPage;
use App\Models\MediaAsset;

/**
 * Pengaturan halaman profil "Tentang Kami" (cms_pages slug 'tentang-kami').
 *
 * Mengatur seluruh konten profil publik:
 * 1. Informasi utama (judul, subjudul/tagline, headline, deskripsi)
 * 2. Foto & media (foto utama + galeri 1-4 dokumentasi workshop/produksi)
 * 3. Statistik utama (4 kartu highlight keunggulan)
 * 4. Kepercayaan pelanggan & alasan memilih (why_points & trust_rows)
 * 5. Proses produksi & workshop (production_processes)
 * 6. Cara kerja kami / alur pemesanan (work_steps)
 * 7. Tautan peta Google Maps
 */
class AboutPageSettings
{
    public const PAGE_SLUG = 'tentang-kami';

    /** Ikon resmi yang boleh dipakai admin (terdaftar di iconRegistry). */
    public const ICONS = [
        'storefront', 'ruler', 'package', 'check-circle', 'headset',
        'hand-coins', 'truck', 'shield-check', 'star', 'sparkle',
        'clock', 'users', 'wrench', 'whatsapp', 'cube', 'map-pin',
        'camera', 'check', 'info', 'heart', 'lock',
    ];
    /** Label ramah admin untuk tiap ikon: dropdown tidak menampilkan kode mentah. */
    public const ICON_LABELS = [
        'storefront' => 'Toko & Workshop',
        'ruler' => 'Ukuran & Custom',
        'package' => 'Packing & Kirim',
        'check-circle' => 'Proses Jelas',
        'headset' => 'Layanan & Konsultasi',
        'hand-coins' => 'Harga & Hemat',
        'truck' => 'Pengiriman',
        'shield-check' => 'Garansi & Aman',
        'star' => 'Unggulan',
        'sparkle' => 'Sorotan',
        'clock' => 'Waktu & Cepat',
        'users' => 'Pelanggan & Tim',
        'wrench' => 'Pengerjaan',
        'whatsapp' => 'WhatsApp',
        'cube' => 'Produk & Unit',
        'map-pin' => 'Lokasi & Alamat',
        'camera' => 'Kamera & Dokumentasi',
        'check' => 'Centang',
        'info' => 'Informasi',
        'heart' => 'Pelayanan',
        'lock' => 'Keamanan',
    ];

    /** @var list<array{value:string,label:string,description:string}> */
    public const DEFAULT_STATS = [
        [
            'value' => '15+',
            'label' => 'Tahun Pengalaman',
            'description' => 'Beroperasi sejak 2008',
        ],
        [
            'value' => '30.000+',
            'label' => 'Variasi Ukuran & Model',
            'description' => 'Pilihan terlengkap',
        ],
        [
            'value' => '1.000.000+',
            'label' => 'Unit Terpasang',
            'description' => 'Dipercaya ribuan hunian',
        ],
        [
            'value' => 'Seluruh Indonesia',
            'label' => 'Jangkauan Pengiriman',
            'description' => 'Packing kayu aman',
        ],
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

    /** @var list<array{icon:string,title:string,description:string,image_url:?string}> */
    public const DEFAULT_PROCESSES = [
        [
            'icon' => 'storefront',
            'title' => 'Workshop Mandiri',
            'description' => 'Fasilitas produksi sendiri dengan peralatan presisi untuk pemotongan dan perakitan aluminium.',
            'image_url' => null,
        ],
        [
            'icon' => 'wrench',
            'title' => 'Pengerjaan Tenaga Ahli',
            'description' => 'Dikerjakan langsung oleh teknisi spesialis aluminium yang teliti di setiap sambungan dan sudut.',
            'image_url' => null,
        ],
        [
            'icon' => 'shield-check',
            'title' => 'Produk Real & Teruji',
            'description' => 'Setiap unit melalui pemeriksaan fungsi kunci, kerapatan seal, dan uji kelancaran sebelum dikirim.',
            'image_url' => null,
        ],
    ];

    /** @var list<array{title:string,body:string}> */
    public const DEFAULT_WORK_STEPS = [
        ['title' => 'Pilih Produk', 'body' => 'Tentukan model, ukuran, warna kusen, dan jenis kaca yang dibutuhkan.'],
        ['title' => 'Konfirmasi WA', 'body' => 'Admin mengonfirmasi rincian ukuran, kelengkapan aksesoris, dan jadwal produksi.'],
        ['title' => 'Packing & Kirim', 'body' => 'Pesanan dikemas kayu dengan aman dan dikirim menggunakan armada kargo terpercaya.'],
    ];

    /** @var list<string> */
    public const DEFAULT_TRUST_ROWS = [
        'Melayani pengiriman ke seluruh Indonesia',
        'Konsultasi ukuran & model gratis sebelum produksi',
        'Konfirmasi detail spesifikasi pesanan sebelum diproses',
        'Garansi penggantian jika produk rusak saat pengiriman',
    ];

    /** Opsi ikon untuk form admin: {value, label} berbahasa Indonesia. */
    public static function iconOptions(): array
    {
        return collect(self::ICONS)
            ->map(fn (string $icon) => [
                'value' => $icon,
                'label' => self::ICON_LABELS[$icon] ?? ucfirst(str_replace('-', ' ', $icon)),
            ])
            ->values()
            ->all();
    }
    public static function ensurePage(): CmsPage
    {
        $cached = CmsSettings::pageBySlug(self::PAGE_SLUG);
        if ($cached !== null) {
            return $cached;
        }

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
     * @return array<string, mixed>
     */
    /**
     * Payload untuk form admin: memuat kondisi sebenarnya yang aktif di website.
     * Jika admin belum mengisi kustom di DB, tampilkan nilai aktif yang saat ini
     * dipakai oleh storefront (bukan form kosong/statis).
     *
     * @return array<string, mixed>
     */
    public static function getForAdmin(): array
    {
        $content = self::rawContent();

        return [
            'hero_title' => filled($content['hero_title'] ?? null)
                ? (string) $content['hero_title']
                : (string) config('sitemap.brand.name', 'Ragil Aluminium'),
            'hero_subtitle' => filled($content['hero_subtitle'] ?? null)
                ? (string) $content['hero_subtitle']
                : 'Sejak 2008',
            'hero_tagline' => filled($content['hero_tagline'] ?? null)
                ? (string) $content['hero_tagline']
                : (string) config('sitemap.brand.tagline', 'Sejak 2008 memproduksi jendela & pintu aluminium'),
            'hero_headline' => filled($content['hero_headline'] ?? null)
                ? (string) $content['hero_headline']
                : 'Spesialis Jendela & Pintu Aluminium Siap Pasang Berkualitas',
            'hero_description' => filled($content['hero_description'] ?? null)
                ? (string) $content['hero_description']
                : 'Ragil Aluminium memproduksi berbagai model jendela dan pintu aluminium dengan standar presisi tinggi, material pilihan, dan pengerjaan oleh tenaga berpengalaman. Kami melayani kebutuhan rumah tinggal maupun proyek ke seluruh wilayah Indonesia.',
            'main_image_url' => (string) ($content['main_image_url'] ?? ''),
            'main_media_asset_id' => isset($content['main_media_asset_id']) && $content['main_media_asset_id'] ? (int) $content['main_media_asset_id'] : null,
            'gallery_items' => self::normalizeGalleryItems($content['gallery_items'] ?? null),
            'stats_items' => filled($content['stats_items'] ?? null)
                ? self::normalizeStats($content['stats_items'], fallback: false)
                : self::liveStats(),
            'why_points' => self::normalizeWhyPoints($content['why_points'] ?? null, fallback: true),
            'production_processes' => self::normalizeProcesses($content['production_processes'] ?? null, fallback: true),
            'work_steps' => self::normalizeWorkSteps($content['work_steps'] ?? null, fallback: true),
            'trust_rows' => self::normalizeTrustRows($content['trust_rows'] ?? null, fallback: true),
            'google_maps_url' => filled($content['google_maps_url'] ?? null)
                ? (string) $content['google_maps_url']
                : (string) config('sitemap.brand.maps_url', ''),
            'google_maps_embed_url' => filled($content['google_maps_embed_url'] ?? null)
                ? (string) $content['google_maps_embed_url']
                : (string) config('sitemap.brand.maps_embed_url', ''),
        ];
    }

    /**
     * Payload untuk storefront: selalu terisi (fallback ke default baku).
     *
     * @return array<string, mixed>
     */
    public static function forStorefront(): array
    {
        $content = self::rawContent();

        return [
            'hero_title' => self::normalizeHeroTitle($content['hero_title'] ?? null),
            'hero_subtitle' => self::normalizeHeroSubtitle($content['hero_subtitle'] ?? null),
            'hero_tagline' => self::normalizeHeroTagline($content['hero_tagline'] ?? null),
            'hero_headline' => self::normalizeHeroHeadline($content['hero_headline'] ?? null),
            'hero_description' => self::normalizeHeroDescription($content['hero_description'] ?? null),
            'main_image_url' => self::resolveImageUrl(
                $content['main_media_asset_id'] ?? null,
                $content['main_image_url'] ?? null,
            ),
            'gallery_items' => self::normalizeGalleryItems($content['gallery_items'] ?? null),
            'stats_items' => filled($content['stats_items'] ?? null)
                ? self::normalizeStats($content['stats_items'], fallback: false)
                : self::liveStats(),
            'why_points' => self::normalizeWhyPoints($content['why_points'] ?? null, fallback: true),
            'production_processes' => self::normalizeProcesses($content['production_processes'] ?? null, fallback: true),
            'work_steps' => self::normalizeWorkSteps($content['work_steps'] ?? null, fallback: true),
            'trust_rows' => self::normalizeTrustRows($content['trust_rows'] ?? null, fallback: true),
            'google_maps_url' => filled($content['google_maps_url'] ?? null) ? trim((string) $content['google_maps_url']) : null,
            'google_maps_embed_url' => filled($content['google_maps_embed_url'] ?? null) ? trim((string) $content['google_maps_embed_url']) : null,
        ];
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    public static function update(array $payload, ?int $adminId = null): void
    {
        $page = self::ensurePage();

        $mainAssetId = isset($payload['main_media_asset_id']) && $payload['main_media_asset_id'] ? (int) $payload['main_media_asset_id'] : null;
        $mainImageUrl = self::resolveImageUrl($mainAssetId, $payload['main_image_url'] ?? null);

        $content = [
            'hero_title' => mb_substr(trim((string) ($payload['hero_title'] ?? '')), 0, 120),
            'hero_subtitle' => mb_substr(trim((string) ($payload['hero_subtitle'] ?? '')), 0, 120),
            'hero_tagline' => mb_substr(trim((string) ($payload['hero_tagline'] ?? '')), 0, 320),
            'hero_headline' => mb_substr(trim((string) ($payload['hero_headline'] ?? '')), 0, 320),
            'hero_description' => mb_substr(trim((string) ($payload['hero_description'] ?? '')), 0, 2000),
            'main_media_asset_id' => $mainAssetId,
            'main_image_url' => $mainImageUrl,
            'gallery_items' => self::normalizeGalleryItems($payload['gallery_items'] ?? null),
            'stats_items' => self::normalizeStats($payload['stats_items'] ?? null, fallback: false),
            'why_points' => self::normalizeWhyPoints($payload['why_points'] ?? null, fallback: false),
            'production_processes' => self::normalizeProcesses($payload['production_processes'] ?? null, fallback: false),
            'work_steps' => self::normalizeWorkSteps($payload['work_steps'] ?? null, fallback: false),
            'trust_rows' => self::normalizeTrustRows($payload['trust_rows'] ?? null, fallback: false),
            'google_maps_url' => filled($payload['google_maps_url'] ?? null) ? trim((string) $payload['google_maps_url']) : null,
            'google_maps_embed_url' => filled($payload['google_maps_embed_url'] ?? null) ? trim((string) $payload['google_maps_embed_url']) : null,
        ];

        $page->update([
            'content' => $content,
            'updated_by_admin_id' => $adminId,
        ]);

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
        $page = CmsSettings::pageBySlug(self::PAGE_SLUG);
        $content = $page && is_array($page->content) ? $page->content : [];

        return $content;
    }

    protected static function normalizeHeroTitle(mixed $raw): string
    {
        $value = trim((string) ($raw ?? ''));

        return $value !== '' ? $value : 'Ragil Aluminium';
    }

    protected static function normalizeHeroSubtitle(mixed $raw): string
    {
        $value = trim((string) ($raw ?? ''));

        return $value !== '' ? $value : 'Sejak 2008';
    }

    protected static function normalizeHeroTagline(mixed $raw): string
    {
        $value = trim((string) ($raw ?? ''));

        return $value !== '' ? $value : 'Sejak 2008 memproduksi jendela & pintu aluminium';
    }

    protected static function normalizeHeroHeadline(mixed $raw): string
    {
        $value = trim((string) ($raw ?? ''));

        return $value !== '' ? $value : 'Spesialis Jendela & Pintu Aluminium Siap Pasang Berkualitas';
    }

    protected static function normalizeHeroDescription(mixed $raw): string
    {
        $value = trim((string) ($raw ?? ''));

        return $value !== '' ? $value : 'Ragil Aluminium memproduksi berbagai model jendela dan pintu aluminium dengan standar presisi tinggi, material pilihan, dan pengerjaan oleh tenaga berpengalaman. Kami melayani kebutuhan rumah tinggal maupun proyek ke seluruh wilayah Indonesia.';
    }

    /**
     * Statistik hidup dari kondisi nyata website: jumlah varian dihitung dari
     * database (bukan klaim marketing statis). Dipakai bersama oleh form
     * admin (getForAdmin) dan storefront (forStorefront) supaya angka yang
     * diedit admin selalu sama dengan angka yang tampil ke pelanggan.
     *
     * @return list<array{value:string,label:string,description:string}>
     */
    public static function liveStats(): array
    {
        $variantCount = \App\Models\ProductVariant::query()->count();
        $variantLabel = $variantCount >= 100
            ? number_format((int) (floor($variantCount / 100) * 100), 0, ',', '.') . '+'
            : $variantCount . '+';

        return [
            [
                'value' => '15+',
                'label' => 'Tahun Pengalaman',
                'description' => 'Beroperasi sejak 2008',
            ],
            [
                'value' => $variantLabel,
                'label' => 'Variasi Ukuran & Model',
                'description' => number_format($variantCount, 0, ',', '.') . ' variasi terdaftar di katalog',
            ],
            [
                'value' => '1.000.000+',
                'label' => 'Unit Terpasang',
                'description' => 'Dipercaya ribuan hunian & proyek di Indonesia',
            ],
            [
                'value' => 'Seluruh Indonesia',
                'label' => 'Jangkauan Pengiriman',
                'description' => 'Packing kayu aman via ekspedisi kargo',
            ],
        ];
    }
    /**
     * @return list<array{media_asset_id:?int,url:string,title:string,caption:string}>
     */
    protected static function normalizeGalleryItems(mixed $raw): array
    {
        $items = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 4) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $assetId = isset($row['media_asset_id']) && $row['media_asset_id'] ? (int) $row['media_asset_id'] : null;
            $url = self::resolveImageUrl($assetId, $row['url'] ?? null);
            if (! $url) {
                continue;
            }
            $items[] = [
                'media_asset_id' => $assetId,
                'url' => $url,
                'title' => mb_substr(trim((string) ($row['title'] ?? '')), 0, 60),
                'caption' => mb_substr(trim((string) ($row['caption'] ?? '')), 0, 200),
            ];
        }

        return $items;
    }

    /**
     * @return list<array{value:string,label:string,description:string}>
     */
    protected static function normalizeStats(mixed $raw, bool $fallback = true): array
    {
        $stats = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 4) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $value = trim((string) ($row['value'] ?? ''));
            $label = trim((string) ($row['label'] ?? ''));
            if ($value === '' && $label === '') {
                continue;
            }
            $stats[] = [
                'value' => mb_substr($value, 0, 40),
                'label' => mb_substr($label, 0, 60),
                'description' => mb_substr(trim((string) ($row['description'] ?? '')), 0, 120),
            ];
        }

        if (count($stats) === 0 && $fallback) {
            return self::DEFAULT_STATS;
        }

        return $stats;
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
     * @return list<array{icon:string,title:string,description:string,image_url:?string}>
     */
    protected static function normalizeProcesses(mixed $raw, bool $fallback = true): array
    {
        $processes = [];
        $source = is_array($raw) ? $raw : [];

        foreach (array_slice($source, 0, 4) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $processes[] = [
                'icon' => self::normalizeIcon((string) ($row['icon'] ?? 'storefront')),
                'title' => mb_substr($title, 0, 60),
                'description' => mb_substr(trim((string) ($row['description'] ?? '')), 0, 250),
                'image_url' => filled($row['image_url'] ?? null) ? trim((string) $row['image_url']) : null,
            ];
        }

        if ($processes === [] && $fallback) {
            return self::DEFAULT_PROCESSES;
        }

        return $processes;
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

    public static function resolveImageUrl(?int $assetId, ?string $fallbackUrl = null): ?string
    {
        if ($assetId) {
            $asset = MediaAsset::find($assetId);
            if ($asset) {
                $url = $asset->localUrlFor('card') ?: $asset->localUrlFor('pdp') ?: $asset->localUrlFor('thumb');
                if ($url) {
                    return $url;
                }
                if ($asset->object_key) {
                    return $asset->publicUrlForPath((string) $asset->object_key);
                }
            }
        }

        $url = trim((string) ($fallbackUrl ?? ''));

        return $url !== '' ? $url : null;
    }
}
