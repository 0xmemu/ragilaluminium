<?php

namespace App\Support;

/**
 * Pemetaan header template update v2 ke kunci internal yang sudah dipakai.
 *
 * Template v2 memakai header Bahasa Indonesia (SKU Produk, SKU Varian,
 * Variasi, Harga, Stok, dst), sedangkan importer update bekerja dengan kunci
 * Inggris (parent_sku, variant_sku, price, stock). Pemetaan dikumpulkan di
 * sini supaya kedua importer update tidak menyalin daftar yang sama dan tidak
 * bisa berbeda satu sama lain.
 */
final class UpdateImportColumnMap
{
    /**
     * Header v2 -> kunci internal.
     *
     * @var array<string, string>
     */
    private const MAP = [
        'sku_produk' => 'parent_sku',
        'sku_varian' => 'variant_sku',
        'variasi' => 'variant_combination',
        'harga' => 'price',
        'stok' => 'stock',
        'deskripsi_produk' => 'description',
        'spesifikasi' => 'specifications',
        'nama_produk' => 'product_name',
        // Kolom media v2.
        'gambar_per_varian' => 'image_variation_option',
        'gambar_1_utama' => 'image_1',
        'gambar_2' => 'image_2',
        'gambar_3' => 'image_3',
        'media_bersama_1' => 'shared_media_1',
        'media_bersama_2' => 'shared_media_2',
        'gambar_hasil_pemasangan_1' => 'installation_image_1',
        'gambar_hasil_pemasangan_2' => 'installation_image_2',
    ];

    /**
     * Selaraskan baris: kunci internal diisi dari header v2 bila ada, tanpa
     * menimpa nilai lama. Dengan begitu berkas lama tetap terbaca.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function normalize(array $data): array
    {
        foreach (self::MAP as $v2Key => $internalKey) {
            if (! array_key_exists($v2Key, $data)) {
                continue;
            }
            // Kunci internal hanya diisi bila belum ada, supaya berkas lama
            // (yang sudah memakai kunci internal) tidak tertimpa nilai kosong.
            if (! array_key_exists($internalKey, $data) || $data[$internalKey] === null || $data[$internalKey] === '') {
                $data[$internalKey] = $data[$v2Key];
            }
        }

        return $data;
    }
}
