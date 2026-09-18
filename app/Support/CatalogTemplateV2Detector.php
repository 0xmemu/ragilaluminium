<?php

namespace App\Support;

/**
 * Pengenal format berkas import katalog.
 *
 * Format v2 memakai header Bahasa Indonesia (nama_produk), sedangkan format
 * lama memakai header Inggris teknis (id_key, name). Deteksi dilakukan dari
 * nama kolom karena itu satu-satunya penanda yang tersedia sebelum baris data
 * dibaca.
 */
final class CatalogTemplateV2Detector
{
    /** Penanda khas format v2. */
    private const V2_MARKER = 'nama_produk';

    /** Penanda khas format lama. */
    private const V1_MARKERS = ['id_key', 'price_variantion_combination', 'variantion_combination'];

    public static function isV2(array $rows): bool
    {
        return array_key_exists(self::V2_MARKER, $rows[0] ?? []);
    }

    public static function isLegacy(array $rows): bool
    {
        foreach (self::V1_MARKERS as $marker) {
            if (array_key_exists($marker, $rows[0] ?? [])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Pesan galat untuk berkas format lama.
     *
     * Owner memutuskan format v2 sepenuhnya menggantikan yang lama. Menolak
     * dengan pesan yang menunjuk tombol unduh lebih selamat daripada
     * memelihara dua format yang harus dirawat bersamaan.
     */
    public static function legacyRejectionMessage(): string
    {
        return 'Berkas ini memakai template lama. Template import sudah diganti, '
            .'unduh template baru lewat tombol Unduh Template Import Produk di halaman '
            .'Import, lalu isi ulang berkasnya.';
    }

    /**
     * Pesan galat untuk berkas yang tidak dikenali sebagai format mana pun.
     */
    public static function unknownRejectionMessage(): string
    {
        return 'Format berkas tidak dikenali. Pastikan berkas memakai template resmi '
            .'yang diunduh dari halaman Import.';
    }
}
