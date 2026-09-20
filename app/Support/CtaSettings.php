<?php

namespace App\Support;

use App\Models\CmsPage;
use App\Models\User;

/**
 * Pengaturan teks CTA storefront (banner penutup, kartu reusable, tombol judul
 * section, kondisi kosong), dapat diedit admin lewat Pengaturan Website > CTA
 * Storefront.
 *
 * ATURAN UTAMA: pengaturan ini LAPISAN PEMBANDING, bukan sumber teks.
 * Selama admin belum menyimpan sebuah kolom, `get()` mengembalikan null (atau
 * daftar kosong) untuk kolom itu, dan komponen storefront memakai teksnya
 * sendiri. Jadi memasang fitur ini TIDAK PERNAH mengubah tampilan storefront.
 * Perubahan baru terlihat setelah admin menekan Simpan.
 *
 * Teks live (yang tampil hari ini) tidak disalin ke kelas ini, melainkan dibaca
 * dari resources/js/lib/cta-live.json, satu berkas yang juga diimpor komponen
 * React. Dengan begitu halaman admin tidak bisa menampilkan teks yang berbeda
 * dari yang benar-benar dirender storefront.
 *
 * Disimpan di cms_pages.slug = 'cta' pada key content['cta_storefront'].
 */
class CtaSettings
{
    public const PAGE_SLUG = 'cta';

    public const CONTENT_KEY = 'cta_storefront';

    /** Relatif terhadap resources/. Dibaca PHP dan diimpor React. */
    public const REGISTRY_PATH = 'js/lib/cta-live.json';

    /** Warna banner brand, dipakai tombol "kembalikan warna brand" di admin. */
    public const DEFAULT_COLOR = '#C00000';

    public const MAX_ACTIONS = 2;

    public const MAX_ITEMS = 6;

    /**
     * Tujuan tombol yang diizinkan. Tombol CTA tidak menerima tautan bebas:
     * admin memilih dari daftar ini supaya jalur konsultasi dan checkout tidak
     * bisa rusak karena salah menyalin URL.
     *
     * @var array<string, string>
     */
    public const DESTINATIONS = [
        'whatsapp' => 'Chat WhatsApp (nomor toko)',
        'home' => 'Beranda',
        'catalog.index' => 'Pilih Model Produk (/products)',
        'catalog.all' => 'Semua Produk (/products/all)',
        'catalog.category.jendela' => 'Produk kategori Jendela (/products/jendela)',
        'installation.index' => 'Hasil Pemasangan (/hasil-pemasangan)',
        'reviews.screenshots' => 'Ulasan screenshot (/reviews/ss)',
        'reviews.website' => 'Ulasan website (/reviews/web)',
        'faq' => 'Sering Ditanyakan (/faq)',
        'cara-pemesanan' => 'Cara Pemesanan (/cara-pemesanan)',
        'masalah-dan-solusi' => 'Masalah & Solusi (/masalah-dan-solusi)',
        'about' => 'Tentang Kami (/about)',
        'contact' => 'Hubungi Kami (/contact)',
    ];

    /** Registry blok, dimuat sekali per request. */
    private static ?array $registry = null;

    /**
     * Peta blok: key => {label, kind, eyebrow, heading, actions, items, ...}.
     * Urutan mengikuti berkas registry supaya urutan di halaman admin stabil.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function registry(): array
    {
        if (self::$registry !== null) {
            return self::$registry;
        }

        $path = resource_path(self::REGISTRY_PATH);
        $decoded = is_file($path)
            ? json_decode((string) file_get_contents($path), true)
            : null;

        $blocks = [];
        foreach ((array) ($decoded['blocks'] ?? []) as $block) {
            if (! is_array($block) || ! isset($block['key'])) {
                continue;
            }
            $key = (string) $block['key'];
            $blocks[$key] = [
                'key' => $key,
                'label' => (string) ($block['label'] ?? $key),
                'kind' => (string) ($block['kind'] ?? 'banner'),
                'preview_url' => $block['preview_url'] ?? null,
                'dynamic' => (bool) ($block['dynamic'] ?? false),
                'note' => $block['note'] ?? null,
                'eyebrow' => (string) ($block['eyebrow'] ?? ''),
                'heading' => (string) ($block['heading'] ?? ''),
                'actions' => array_values(array_filter(
                    (array) ($block['actions'] ?? []),
                    fn ($action) => is_array($action) && isset($action['label']),
                )),
                'items' => array_values(array_filter(
                    (array) ($block['items'] ?? []),
                    fn ($item) => is_array($item) && isset($item['label']),
                )),
            ];
        }

        return self::$registry = $blocks;
    }

    /** @return array<string, string> key => label, urut seperti registry. */
    public static function pages(): array
    {
        return array_map(fn (array $block): string => $block['label'], self::registry());
    }

    /**
     * Teks yang BENAR-BENAR dirender storefront hari ini, untuk ditampilkan
     * sebagai nilai awal di halaman admin.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function live(): array
    {
        return self::registry();
    }

    /**
     * Nilai yang sudah disimpan admin. Kolom yang belum pernah disimpan bernilai
     * null (atau daftar kosong) supaya storefront tetap memakai teksnya sendiri.
     *
     * @return array{enabled: bool, color: ?string, pages: array<string, array{eyebrow: ?string, heading: ?string, actions: list<array{label: string, destination: string, variant: string}>, items: list<array{label: string, description: string}>}>}
     */
    public static function get(): array
    {
        $stored = self::read();
        $pages = [];

        foreach (array_keys(self::pages()) as $key) {
            $row = is_array($stored['pages'][$key] ?? null) ? $stored['pages'][$key] : [];
            $pages[$key] = [
                'eyebrow' => self::text($row['eyebrow'] ?? null, 120),
                'heading' => self::text($row['heading'] ?? null, 240),
                'actions' => self::actions($row['actions'] ?? [], $key),
                'items' => self::items($row['items'] ?? []),
            ];
        }

        return [
            'enabled' => $stored === [] ? true : (bool) ($stored['enabled'] ?? true),
            'color' => self::color($stored['color'] ?? null),
            'pages' => $pages,
        ];
    }

    /**
     * Simpan pengaturan. Nilai yang dikirim admin disimpan apa adanya; teks
     * kosong berarti kolom itu kembali ke teks storefront (bukan disalin dari
     * teks live, supaya tidak membekukan teks yang nanti diperbarui di kode).
     *
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    public static function update(array $incoming, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];

        $pages = [];
        foreach (array_keys(self::pages()) as $key) {
            $row = is_array($incoming['pages'][$key] ?? null) ? $incoming['pages'][$key] : [];
            $pages[$key] = [
                'eyebrow' => self::text($row['eyebrow'] ?? null, 120),
                'heading' => self::text($row['heading'] ?? null, 240),
                'actions' => self::actions($row['actions'] ?? [], $key),
                'items' => self::items($row['items'] ?? []),
            ];
        }

        $content[self::CONTENT_KEY] = [
            'enabled' => (bool) ($incoming['enabled'] ?? true),
            'color' => self::color($incoming['color'] ?? null),
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
     * Buang seluruh nilai tersimpan sehingga storefront kembali memakai teks
     * aslinya. Dipakai saat teks dipindahkan kembali ke kode.
     */
    public static function forget(): void
    {
        $page = self::page();
        if (! $page) {
            return;
        }

        $content = is_array($page->content) ? $page->content : [];
        unset($content[self::CONTENT_KEY]);
        $page->content = $content;
        $page->save();

        CmsSettings::forgetPage(self::PAGE_SLUG);
    }

    /**
     * Rapikan daftar tombol satu blok. Tombol dikembalikan apa adanya bila sah,
     * dan daftar KOSONG bila admin belum menyimpan tombol: komponen lalu
     * memakai tombolnya sendiri.
     *
     * Blok `section` (tombol kecil di samping judul section) hanya menyimpan
     * label: tautannya menyatu dengan tata letak section, jadi tidak boleh
     * diganti dari sini.
     *
     * @return list<array{label: string, destination: string, variant: string}>
     */
    private static function actions(mixed $incoming, string $key): array
    {
        $kind = self::registry()[$key]['kind'] ?? 'banner';
        $labelOnly = $kind === 'section';
        $clean = [];

        foreach ((array) ($incoming ?? []) as $action) {
            if (! is_array($action) || count($clean) >= self::MAX_ACTIONS) {
                break;
            }
            $label = self::text($action['label'] ?? null, 40);
            if ($label === null) {
                continue;
            }

            $destination = trim((string) ($action['destination'] ?? ''));
            if ($labelOnly) {
                $destination = '';
            } elseif (! isset(self::DESTINATIONS[$destination])) {
                continue;
            }

            $clean[] = [
                'label' => $label,
                'destination' => $destination,
                'variant' => $labelOnly
                    ? 'secondary'
                    : (($action['variant'] ?? 'primary') === 'secondary' ? 'secondary' : 'primary'),
            ];
        }

        return $clean;
    }

    /**
     * Rapikan daftar kartu/poin satu blok: label wajib, keterangan opsional,
     * maksimal 6 baris.
     *
     * @return list<array{label: string, description: string}>
     */
    private static function items(mixed $incoming): array
    {
        $clean = [];

        foreach ((array) ($incoming ?? []) as $item) {
            if (count($clean) >= self::MAX_ITEMS) {
                break;
            }
            // Bentuk lama (string) tetap diterima supaya data tersimpan dari
            // versi sebelumnya tidak hilang saat dibaca.
            $raw = is_array($item) ? $item : ['label' => $item];

            $label = self::text($raw['label'] ?? null, 120);
            if ($label === null) {
                continue;
            }
            $clean[] = [
                'label' => $label,
                'description' => self::text($raw['description'] ?? null, 240) ?? '',
            ];
        }

        return $clean;
    }

    /** @return array<string, mixed> */
    private static function read(): array
    {
        $stored = self::page()?->content[self::CONTENT_KEY] ?? null;

        return is_array($stored) ? $stored : [];
    }

    /** Warna hex 6 digit, atau null bila belum diatur admin. */
    private static function color(mixed $value): ?string
    {
        $color = trim((string) $value);

        return preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? $color : null;
    }

    /** Rapikan teks: trim, rapatkan spasi; null bila kosong. */
    private static function text(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $clean = trim(preg_replace('/\s+/u', ' ', $value) ?? '');

        return $clean === '' ? null : mb_substr($clean, 0, $max);
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
