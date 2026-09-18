<?php

namespace App\Support;

/**
 * Sumber tunggal kolom template katalog v2 (1 berkas terpisah per fungsi).
 *
 * Tiga template: Import Produk, Update Produk, Update Media. Ketiganya membaca
 * definisi kolom dari sini supaya satu konsep tidak pernah punya dua nama dan
 * urutan kolom tidak bisa berbeda antara eksportir dan importer.
 *
 * Aturan yang dipegang:
 *  - Satu baris = satu varian. Tidak ada lagi kolom opsi 1 sampai 4.
 *  - Lebar (cm) dipetakan ke depth_cm milik sistem (keputusan owner: kedalaman
 *    itu lebar). Istilah "Kedalaman" tidak dipakai di template.
 *  - Berat dan dimensi hanya untuk pengiriman. Keempatnya tidak pernah
 *    dirender ke storefront.
 *  - Nama kolom media seragam di semua template, mis. Gambar per Varian.
 */
final class CatalogTemplateV2
{
    /** Grup fungsi menentukan warna header di ketiga template. */
    public const GROUP_IDENTITAS = 1;

    public const GROUP_VARIASI = 2;

    public const GROUP_HARGA_KIRIM = 3;

    public const GROUP_MEDIA = 4;

    /**
     * Warna header per grup. Semua gelap supaya teks putih tetap terbaca.
     * Grup identitas memakai merah brand agar sama dengan berkas owner.
     *
     * @var array<int, string>
     */
    public const GROUP_COLORS = [
        self::GROUP_IDENTITAS => 'FFC20000',
        self::GROUP_VARIASI => 'FF1F497D',
        self::GROUP_HARGA_KIRIM => 'FFB45309',
        self::GROUP_MEDIA => 'FF0F766E',
    ];

    /**
     * Legenda grup untuk sheet Panduan.
     *
     * @var array<int, string>
     */
    public const GROUP_LABELS = [
        self::GROUP_IDENTITAS => 'Identitas & Produk',
        self::GROUP_VARIASI => 'Variasi',
        self::GROUP_HARGA_KIRIM => 'Harga & Pengiriman',
        self::GROUP_MEDIA => 'Media',
    ];

    /**
     * Kolom template Import Produk (produk dan varian baru).
     *
     * @return list<array{header: string, slug: string, group: int}>
     */
    public static function importColumns(): array
    {
        $cols = [];
        $add = static function (string $header, string $slug, int $group) use (&$cols): void {
            $cols[] = ['header' => $header, 'slug' => $slug, 'group' => $group];
        };

        // Grup 1: identitas dan data produk.
        $add('NO. ID', 'no_id', self::GROUP_IDENTITAS);
        $add('Nama Produk', 'nama_produk', self::GROUP_IDENTITAS);
        $add('Deskripsi Produk', 'deskripsi_produk', self::GROUP_IDENTITAS);
        $add('Spesifikasi', 'spesifikasi', self::GROUP_IDENTITAS);
        $add('Kategori Produk', 'kategori_produk', self::GROUP_IDENTITAS);
        $add('Model Produk', 'model_produk', self::GROUP_IDENTITAS);
        $add('Sub Model', 'sub_model', self::GROUP_IDENTITAS);

        // Grup 2: sumbu variasi.
        $add('Nama Variasi 1', 'nama_variasi_1', self::GROUP_VARIASI);
        $add('Opsi Variasi 1', 'opsi_variasi_1', self::GROUP_VARIASI);

        // Grup 4: gambar milik varian (posisinya dekat variasi, warnanya media).
        $add('Gambar per Varian', 'gambar_per_varian', self::GROUP_MEDIA);

        $add('Nama Variasi 2', 'nama_variasi_2', self::GROUP_VARIASI);
        $add('Opsi Variasi 2', 'opsi_variasi_2', self::GROUP_VARIASI);

        // Grup 3: harga dan data pengiriman.
        $add('Harga', 'harga', self::GROUP_HARGA_KIRIM);
        $add('Stok', 'stok', self::GROUP_HARGA_KIRIM);
        $add('Berat (Kg)', 'berat_kg', self::GROUP_HARGA_KIRIM);
        $add('Tinggi (cm)', 'tinggi_cm', self::GROUP_HARGA_KIRIM);
        $add('Panjang (cm)', 'panjang_cm', self::GROUP_HARGA_KIRIM);
        $add('Lebar (cm)', 'lebar_cm', self::GROUP_HARGA_KIRIM);

        // Grup 4: media katalog dan pemasangan.
        $add('Gambar 1 (utama)', 'gambar_1_utama', self::GROUP_MEDIA);
        $add('Gambar 2', 'gambar_2', self::GROUP_MEDIA);
        $add('Media Bersama 1', 'media_bersama_1', self::GROUP_MEDIA);
        $add('Media Bersama 2', 'media_bersama_2', self::GROUP_MEDIA);
        $add('Gambar Hasil Pemasangan 1', 'gambar_hasil_pemasangan_1', self::GROUP_MEDIA);
        $add('Gambar Hasil Pemasangan 2', 'gambar_hasil_pemasangan_2', self::GROUP_MEDIA);

        return $cols;
    }

    /**
     * Kolom template Update Produk. Empat kolom pertama adalah identitas yang
     * DIKUNCI; sisanya boleh diubah admin.
     *
     * @return list<array{header: string, slug: string, group: int, locked: bool}>
     */
    public static function updateProductColumns(): array
    {
        return [
            ['header' => 'SKU Produk', 'slug' => 'sku_produk', 'group' => self::GROUP_IDENTITAS, 'locked' => true],
            ['header' => 'Nama Produk', 'slug' => 'nama_produk', 'group' => self::GROUP_IDENTITAS, 'locked' => true],
            ['header' => 'SKU Varian', 'slug' => 'sku_varian', 'group' => self::GROUP_IDENTITAS, 'locked' => true],
            ['header' => 'Variasi', 'slug' => 'variasi', 'group' => self::GROUP_VARIASI, 'locked' => true],
            ['header' => 'Harga', 'slug' => 'harga', 'group' => self::GROUP_HARGA_KIRIM, 'locked' => false],
            ['header' => 'Stok', 'slug' => 'stok', 'group' => self::GROUP_HARGA_KIRIM, 'locked' => false],
            ['header' => 'Deskripsi Produk', 'slug' => 'deskripsi_produk', 'group' => self::GROUP_IDENTITAS, 'locked' => false],
            ['header' => 'Spesifikasi', 'slug' => 'spesifikasi', 'group' => self::GROUP_IDENTITAS, 'locked' => false],
        ];
    }

    /**
     * Kolom template Update Media. Empat kolom pertama dikunci; seluruh kolom
     * media boleh diubah admin dan dibiarkan kosong saat diunduh.
     *
     * @return list<array{header: string, slug: string, group: int, locked: bool}>
     */
    public static function updateMediaColumns(): array
    {
        return [
            ['header' => 'SKU Produk', 'slug' => 'sku_produk', 'group' => self::GROUP_IDENTITAS, 'locked' => true],
            ['header' => 'Nama Produk', 'slug' => 'nama_produk', 'group' => self::GROUP_IDENTITAS, 'locked' => true],
            ['header' => 'SKU Varian', 'slug' => 'sku_varian', 'group' => self::GROUP_IDENTITAS, 'locked' => true],
            ['header' => 'Variasi', 'slug' => 'variasi', 'group' => self::GROUP_VARIASI, 'locked' => true],
            ['header' => 'Gambar per Varian', 'slug' => 'gambar_per_varian', 'group' => self::GROUP_MEDIA, 'locked' => false],
            ['header' => 'Gambar 1 (utama)', 'slug' => 'gambar_1_utama', 'group' => self::GROUP_MEDIA, 'locked' => false],
            ['header' => 'Gambar 2', 'slug' => 'gambar_2', 'group' => self::GROUP_MEDIA, 'locked' => false],
            ['header' => 'Media Bersama 1', 'slug' => 'media_bersama_1', 'group' => self::GROUP_MEDIA, 'locked' => false],
            ['header' => 'Media Bersama 2', 'slug' => 'media_bersama_2', 'group' => self::GROUP_MEDIA, 'locked' => false],
            ['header' => 'Gambar Hasil Pemasangan 1', 'slug' => 'gambar_hasil_pemasangan_1', 'group' => self::GROUP_MEDIA, 'locked' => false],
            ['header' => 'Gambar Hasil Pemasangan 2', 'slug' => 'gambar_hasil_pemasangan_2', 'group' => self::GROUP_MEDIA, 'locked' => false],
        ];
    }

    /**
     * Penanda hapus media. Sel kosong berarti tidak mengubah, sehingga admin
     * butuh penanda khusus untuk menghapus (keputusan owner).
     */
    public const DELETE_MARKER = 'hapus';

    /**
     * Label variasi yang dibaca admin, mis. "Putih, Kaca Bening".
     *
     * Dipakai template Update Produk dan Update Media supaya keduanya tidak
     * pernah memakai bentuk label yang berbeda untuk varian yang sama.
     */
    public static function variationLabel(?\App\Models\ProductVariant $variant): string
    {
        if ($variant === null) {
            return "";
        }

        return trim(implode(", ", array_filter([
            trim((string) $variant->variation_1_option),
            trim((string) $variant->variation_2_option),
        ])));
    }

    /** @param list<array{header: string}> $columns */
    public static function headers(array $columns): array
    {
        return array_map(static fn (array $c): string => $c['header'], $columns);
    }

    /** @param list<array{slug: string}> $columns */
    public static function slugs(array $columns): array
    {
        return array_map(static fn (array $c): string => $c['slug'], $columns);
    }

    /**
     * Huruf kolom (A, B, ...) per slug, untuk memetakan target importer.
     *
     * @param  list<array{slug: string}>  $columns
     * @return array<string, string>
     */
    public static function lettersBySlug(array $columns): array
    {
        $out = [];
        foreach ($columns as $i => $col) {
            $out[$col['slug']] = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
        }

        return $out;
    }
}
