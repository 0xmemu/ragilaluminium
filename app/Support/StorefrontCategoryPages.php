<?php

namespace App\Support;

/**
 * Konfigurasi halaman kategori storefront (landing page ala homepage).
 *
 * Satu template `Public/CategoryPage` dipakai untuk SEMUA kategori — perbedaan
 * antar kategori murni data (title, deskripsi, hero, benefits, link view-all),
 * bukan file/layout terpisah. Data default di sini; `hero_image` boleh diisi
 * nanti (mis. dari CMS banner) dan controller mengisi fallback dari katalog.
 */
class StorefrontCategoryPages
{
    /**
     * @var array<string, array{code:string,title:string,description:string,hero_image:?string,benefits:list<array{icon:string,label:string}>}>
     */
    private const PAGES = [
        'windows' => [
            'code' => 'WINDOW',
            'title' => 'Jendela Aluminium',
            'description' => 'Jendela aluminium Ragil Aluminium tersedia dalam berbagai model bukaan — jungkit, swing, dan sliding — siap custom ukuran untuk setiap ruangan di rumah Anda.',
            'hero_image' => null,
            'benefits' => [
                ['icon' => 'sun', 'label' => 'Maksimalkan Pencahayaan'],
                ['icon' => 'sparkle', 'label' => 'Tampilan Rapi Modern'],
                ['icon' => 'shield-check', 'label' => 'Kokoh untuk Sehari-hari'],
            ],
        ],
        'doors' => [
            'code' => 'DOOR',
            'title' => 'Pintu Aluminium',
            'description' => 'Pintu aluminium Ragil Aluminium — model swing dan sliding yang kokoh, aman, dan rapi untuk setiap akses di hunian Anda.',
            'hero_image' => null,
            'benefits' => [
                ['icon' => 'door-open', 'label' => 'Akses Mudah & Aman'],
                ['icon' => 'shield-check', 'label' => 'Keamanan Terjamin'],
                ['icon' => 'sparkle', 'label' => 'Desain Rapi Modern'],
            ],
        ],
        'bouven' => [
            'code' => 'BOUVEN',
            'title' => 'Boven Aluminium',
            'description' => 'Boven (ventilasi atas) aluminium untuk sirkulasi udara yang optimal — model jungkit, kaca mati, dan sliding untuk ruangan yang lebih sehat.',
            'hero_image' => null,
            'benefits' => [
                ['icon' => 'ruler', 'label' => 'Pas di Ruang Sempit'],
                ['icon' => 'sun', 'label' => 'Sirkulasi Udara Sehat'],
                ['icon' => 'sparkle', 'label' => 'Tampilan Rapi Modern'],
            ],
        ],
    ];

    /** @var array<string, string> Slug (alias) → kunci config. */
    private const SLUG_ALIASES = [
        'windows' => 'windows',
        'window' => 'windows',
        'jendela' => 'windows',
        'doors' => 'doors',
        'door' => 'doors',
        'pintu' => 'doors',
        'bouven' => 'bouven',
        'boven' => 'bouven',
    ];

    /**
     * Definisi halaman kategori untuk sebuah slug. Unknown slug → null (404).
     */
    public static function definition(string $slug): ?array
    {
        $key = self::SLUG_ALIASES[strtolower(trim($slug))] ?? null;
        if ($key === null) {
            return null;
        }

        $page = self::PAGES[$key];
        $page['slug'] = $key;

        return $page;
    }

    /**
     * Kode kategori (WINDOW/DOOR/BOUVEN) → slug kanonis untuk URL katalog listing.
     */
    public static function codeToSlug(?string $code): string
    {
        return match (strtoupper((string) $code)) {
            'DOOR' => 'doors',
            'BOUVEN' => 'bouven',
            default => 'windows',
        };
    }
}
