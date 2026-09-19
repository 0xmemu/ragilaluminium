<?php

namespace App\Support;

use App\Models\CmsPage;
use App\Models\User;

/**
 * Teks CTA penutup (banner merah di akhir halaman publik), dapat diedit admin
 * lewat menu Pengaturan Website > CTA Storefront.
 *
 * Yang dapat diatur hanya KOP dan JUDUL (eyebrow + heading). Tombol/aksi tetap
 * di kode karena terikat rute internal dan tautan WhatsApp: kalau admin salah
 * mengisi tautan, pembeli bisa kehilangan jalur konsultasi atau checkout.
 *
 * Dua jenis blok memakai mekanisme yang sama:
 *   - Banner penutup per halaman (kunci = nama halaman publik).
 *   - Kartu reusable `trust` (kartu jaminan di halaman transaksi).
 * Komponen yang memakainya tinggal memanggil `forPage(<kunci>)`.
 *
 * Disimpan di cms_pages.slug = 'cta' pada key content['cta_storefront'].
 */
class CtaSettings
{
    public const PAGE_SLUG = 'cta';

    public const CONTENT_KEY = 'cta_storefront';

    /** Kunci halaman pemakai CTA penutup + labelnya di halaman admin. */
    public const PAGES = [
        'home' => 'Beranda',
        'model-detail' => 'Detail Model Produk',
        'about' => 'Tentang Kami',
        'faq' => 'Sering Ditanyakan',
        'cara-pemesanan' => 'Cara Pemesanan',
        'masalah-solusi' => 'Masalah & Solusi',
        // Blok ini BUKAN banner penutup, melainkan kartu jaminan yang dipakai
        // berulang di halaman transaksi (keranjang, checkout, konfirmasi
        // pesanan, daftar pesanan, pelacakan). Owner 2026-09-19: komponen
        // reusable juga harus bisa diatur dari halaman ini.
        'trust' => 'Kartu Jaminan (semua halaman)',
        'order-help' => 'Bantuan di halaman Pesanan',
        // Blok di bawah ini ditemukan saat penyisiran ulang 2026-09-19: semuanya
        // teks persuasi yang tampil berulang di storefront tetapi masih keras
        // di kode, jadi admin tidak bisa mengubahnya sama sekali.
        'home-help' => 'Beranda: bagian "Kami bantu"',
        'pdp-benefits' => 'Detail Produk: alasan belanja',
        'catalog-empty' => 'Katalog: saat pencarian kosong',
        'about-contact' => 'Tentang Kami: panel toko & workshop',
    ];

    /**
     * Tujuan tombol yang diizinkan. Tombol CTA tidak menerima tautan bebas:
     * admin memilih dari daftar ini supaya jalur konsultasi/checkout tidak
     * bisa rusak karena salah menyalin URL.
     *
     * @var array<string, string>
     */
    public const DESTINATIONS = [
        'whatsapp' => 'Chat WhatsApp (nomor toko)',
        'home' => 'Beranda',
        'catalog.index' => 'Pilih Model Produk (/products)',
        'catalog.all' => 'Semua Produk (/products/all)',
        'faq' => 'Sering Ditanyakan (/faq)',
        'cara-pemesanan' => 'Cara Pemesanan (/cara-pemesanan)',
        'masalah-dan-solusi' => 'Masalah & Solusi (/masalah-dan-solusi)',
        'about' => 'Tentang Kami (/about)',
        'contact' => 'Hubungi Kami (/contact)',
    ];

    /**
     * Tombol bawaan per blok = tombol yang benar-benar dirender storefront
     * saat ini (dikumpulkan dari call site ClosingCTASection, 2026-09-19).
     * Destination `whatsapp` diselesaikan runtime ke nomor toko.
     *
     * @var array<string, list<array{label: string, destination: string, variant: string}>>
     */
    public const INITIAL_ACTIONS = [
        'home' => [
            ['label' => 'Chat WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
        ],
        'model-detail' => [
            ['label' => 'Chat WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
        ],
        'about' => [
            ['label' => 'Chat WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
            ['label' => 'Lihat Produk', 'destination' => 'catalog.index', 'variant' => 'secondary'],
        ],
        'faq' => [
            ['label' => 'Chat WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
            ['label' => 'Cara pemesanan', 'destination' => 'cara-pemesanan', 'variant' => 'secondary'],
        ],
        'cara-pemesanan' => [
            ['label' => 'Pilih Model Produk', 'destination' => 'catalog.index', 'variant' => 'primary'],
            ['label' => 'Konsultasi Sekarang', 'destination' => 'whatsapp', 'variant' => 'secondary'],
        ],
        'masalah-solusi' => [
            ['label' => 'Konsultasi WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
            ['label' => 'Lihat FAQ', 'destination' => 'faq', 'variant' => 'secondary'],
        ],
        'trust' => [],
        'order-help' => [
            ['label' => 'Hubungi Kami', 'destination' => 'contact', 'variant' => 'secondary'],
        ],
        // Blok baru: hanya yang benar-benar punya tombol di storefront.
        'home-help' => [],
        'pdp-benefits' => [],
        'catalog-empty' => [
            ['label' => 'Konsultasi via WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
            ['label' => 'Lihat semua model', 'destination' => 'catalog.all', 'variant' => 'secondary'],
        ],
        'about-contact' => [
            ['label' => 'Chat WhatsApp', 'destination' => 'whatsapp', 'variant' => 'primary'],
        ],
    ];

    /**
     * Daftar teks bawaan untuk blok berbentuk LENCANA/POIN, bukan satu kalimat.
     * Dikumpulkan dari kode storefront (bukan tebakan).
     *
     * @var array<string, list<string>>
     */
    public const INITIAL_ITEMS = [
        // use-product-purchase.ts `benefits`, tampil 3 kartu di kolom beli PDP.
        'pdp-benefits' => [
            'Garansi 100%',
            'Bayar di tempat (COD)',
            'Kirim ke seluruh Indonesia',
        ],
    ];

    /** Warna banner CTA bawaan (merah brand storefront). */
    public const DEFAULT_COLOR = '#C00000';

    /** Dipakai bila kunci halaman tidak dikenal (mis. halaman baru). */
    public const DEFAULT_TEXT = [
        'eyebrow' => 'Butuh bantuan pilih jendela?',
        'heading' => 'Konsultasi gratis via WhatsApp, admin balas cepat',
    ];

    /**
     * Teks awal = teks yang berlaku sebelum fitur ini ada, supaya memasang fitur
     * ini TIDAK mengubah tampilan storefront sama sekali.
     *
     * @var array<string, array{eyebrow: string, heading: string}>
     */
    public const INITIAL_TEXT = [
        'home' => [
            'eyebrow' => 'Butuh bantuan pilih jendela?',
            'heading' => 'Konsultasi gratis via WhatsApp, admin balas cepat',
        ],
        'model-detail' => [
            'eyebrow' => 'Butuh bantuan pilih jendela?',
            'heading' => 'Konsultasi gratis via WhatsApp, admin balas cepat',
        ],
        'about' => [
            'eyebrow' => 'Butuh bantuan memilih produk?',
            'heading' => 'Konsultasi gratis untuk menentukan model dan ukuran yang sesuai',
        ],
        'faq' => [
            'eyebrow' => 'Masih punya pertanyaan?',
            'heading' => 'Tim kami siap membantu lewat WhatsApp',
        ],
        'cara-pemesanan' => [
            'eyebrow' => 'Siap memesan?',
            'heading' => 'Pilih model aluminium yang tepat, atau konsultasikan kebutuhan Anda lebih dulu',
        ],
        'masalah-solusi' => [
            'eyebrow' => 'Masih ragu spesifikasi yang tepat?',
            'heading' => 'Tim kami siap bantu memilih model & ukuran yang sesuai kebutuhan Anda, gratis tanpa komitmen',
        ],
        'trust' => [
            'eyebrow' => 'Belanja Aman & Terpercaya',
            'heading' => 'Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.',
        ],
        'order-help' => [
            'eyebrow' => 'Butuh bantuan dengan pesanan ini?',
            'heading' => 'Hubungi tim kami, sertakan nomor pesanan agar cepat ditindaklanjuti.',
        ],
        // home-sections.tsx KamiBantuSection.
        'home-help' => [
            'eyebrow' => 'Masih Bingung?',
            'heading' => 'Kami bantu dari awal sampai jadi',
        ],
        // product-buy-box.tsx "Alasan harus belanja di Ragil Aluminium".
        'pdp-benefits' => [
            'eyebrow' => '',
            'heading' => 'Alasan harus belanja di Ragil Aluminium',
        ],
        // Catalog.tsx empty state saat pencarian tidak menemukan hasil.
        'catalog-empty' => [
            'eyebrow' => 'Tidak ada hasil untuk pencarian Anda',
            'heading' => 'Tidak menemukan ukuran yang sesuai? Tim kami siap membantu memastikan produk pas dengan kebutuhan Anda.',
        ],
        // About.tsx panel "Toko & Workshop Ragil Aluminium".
        'about-contact' => [
            'eyebrow' => '',
            'heading' => 'Toko & Workshop Ragil Aluminium',
        ],
    ];

    /**
     * @return array{enabled: bool, pages: array<string, array{eyebrow: string, heading: string}>}
     */
    public static function get(): array
    {
        $stored = self::read();
        $pages = [];
        foreach (array_keys(self::PAGES) as $key) {
            $row = is_array($stored['pages'][$key] ?? null) ? $stored['pages'][$key] : [];
            $initial = self::INITIAL_TEXT[$key] ?? self::DEFAULT_TEXT;
            $pages[$key] = [
                'eyebrow' => self::text($row['eyebrow'] ?? null, $initial['eyebrow'], 120),
                'heading' => self::text($row['heading'] ?? null, $initial['heading'], 240),
                // Tombol: kunci yang belum tersimpan diisi dari tombol live
                // supaya halaman admin selalu menggambarkan CTA sebenarnya.
                'actions' => self::actions($row['actions'] ?? null, $key),
                // Lencana/poin: hanya blok berbentuk daftar yang punya isi.
                'items' => self::items($row['items'] ?? null, $key),
            ];
        }

        $color = trim((string) ($stored['color'] ?? ''));
        if (! preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $color = self::DEFAULT_COLOR;
        }

        return [
            'enabled' => $stored === [] ? true : (bool) ($stored['enabled'] ?? true),
            'color' => $color,
            'pages' => $pages,
        ];
    }

    /**
     * Rapikan daftar tombol satu blok: buang yang tidak lengkap / tujuan tidak
     * dikenal / lebih dari dua (kontrak owner 2026-09-02: maksimal 2 tombol),
     * lalu lengkapi dari tombol live bila kosong.
     *
     * @return list<array{label: string, destination: string, variant: string}>
     */
    private static function actions(mixed $incoming, string $key): array
    {
        $clean = [];
        foreach ((array) ($incoming ?? []) as $action) {
            if (! is_array($action) || count($clean) >= 2) {
                break;
            }
            $label = self::text($action['label'] ?? null, '', 40);
            $destination = trim((string) ($action['destination'] ?? ''));
            if ($label === '' || ! isset(self::DESTINATIONS[$destination])) {
                continue;
            }
            $clean[] = [
                'label' => $label,
                'destination' => $destination,
                'variant' => ($action['variant'] ?? 'primary') === 'secondary' ? 'secondary' : 'primary',
            ];
        }

        if ($clean === []) {
            $clean = self::INITIAL_ACTIONS[$key] ?? [];
        }

        return $clean;
    }

    /**
     * Teks CTA untuk satu halaman, atau null bila CTA dimatikan admin.
     *
     * @return array{eyebrow: string, heading: string}|null
     */
    public static function forPage(string $pageKey): ?array
    {
        $settings = self::get();
        if (! $settings['enabled']) {
            return null;
        }

        return $settings['pages'][$pageKey] ?? self::DEFAULT_TEXT;
    }

    /** @param array<string, mixed> $incoming */
    public static function update(array $incoming, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];

        $pages = [];
        foreach (array_keys(self::PAGES) as $key) {
            $row = is_array($incoming['pages'][$key] ?? null) ? $incoming['pages'][$key] : [];
            $initial = self::INITIAL_TEXT[$key] ?? self::DEFAULT_TEXT;
            $pages[$key] = [
                'eyebrow' => self::text($row['eyebrow'] ?? null, $initial['eyebrow'], 120),
                'heading' => self::text($row['heading'] ?? null, $initial['heading'], 240),
                'actions' => self::actions($row['actions'] ?? [], $key),
                'items' => self::items($row['items'] ?? [], $key),
            ];
        }

        $color = trim((string) ($incoming['color'] ?? ''));
        if (! preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $color = self::DEFAULT_COLOR;
        }

        $content[self::CONTENT_KEY] = [
            'enabled' => (bool) ($incoming['enabled'] ?? true),
            'color' => $color,
            'pages' => $pages,
        ];

        $page->content = $content;
        $page->published = true;
        // Tulis hanya bila user-nya benar-benar ada: kolom ini ber-FK ke users.
        if ($adminId and User::query()->whereKey($adminId)->exists()) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        // CmsSettings menyimpan cache per-request; tanpa dibuang, pembacaan
        // sesudah simpan pada request yang sama masih mengembalikan teks lama.
        CmsSettings::forgetPage(self::PAGE_SLUG);

        return self::get();
    }

    /**
     * Rapikan daftar teks satu blok: buang yang kosong, batasi 6 baris, dan
     * kembalikan daftar live bila hasilnya kosong supaya blok tidak pernah
     * tampil tanpa isi.
     *
     * @return list<string>
     */
    private static function items(mixed $incoming, string $key): array
    {
        $clean = [];
        foreach ((array) ($incoming ?? []) as $item) {
            if (! is_string($item) || count($clean) >= 6) {
                continue;
            }
            $text = self::text($item, '', 120);
            if ($text !== '') {
                $clean[] = $text;
            }
        }

        if ($clean === []) {
            $clean = self::INITIAL_ITEMS[$key] ?? [];
        }

        return $clean;
    }

    /** @return array<string, mixed> */
    private static function read(): array
    {
        $stored = self::page()?->content[self::CONTENT_KEY] ?? null;

        return is_array($stored) ? $stored : [];
    }

    /** Rapikan teks: trim, rapatkan spasi, dan pakai nilai awal bila kosong. */
    private static function text(?string $value, string $fallback, int $max): string
    {
        if ($value === null) {
            return $fallback;
        }

        $clean = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        if ($clean === '') {
            return $fallback;
        }

        return mb_substr($clean, 0, $max);
    }

    private static function page(bool $create = false): ?CmsPage
    {
        $page = CmsSettings::pageBySlug(self::PAGE_SLUG);
        if ($page || ! $create) {
            return $page;
        }

        return CmsPage::create([
            'slug' => self::PAGE_SLUG,
            'title' => 'CTA Storefront',
            'content' => [],
            'published' => true,
        ]);
    }
}
