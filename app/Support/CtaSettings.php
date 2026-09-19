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
    ];

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
            ];
        }

        return [
            'enabled' => $stored === [] ? true : (bool) ($stored['enabled'] ?? true),
            'pages' => $pages,
        ];
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
            ];
        }

        $content[self::CONTENT_KEY] = [
            'enabled' => (bool) ($incoming['enabled'] ?? true),
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
