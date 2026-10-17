<?php

use App\Models\CmsModelProduct;
use App\Support\CatalogLabels;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;

/**
 * Buang sisipan "Aluminium" dari nama wadah model produk yang dibuat otomatis.
 *
 * Sampai 17 Okt 2026 penyelarasan otomatis menamai wadah
 * "<Kategori> Aluminium <Model>", mis. "Jendela Aluminium Jungkit". Katalog ke
 * depan tidak selalu aluminium, jadi pola baru hanya memakai kolom yang dipilih
 * admin: "<Kategori> <Model>" menjadi "Jendela Jungkit".
 *
 * Hanya nama yang PERSIS mengikuti pola lama yang diubah. Nama yang sudah
 * disunting admin dibiarkan apa adanya.
 */
return new class extends Migration
{
    public function up(): void
    {
        $rows = CmsModelProduct::query()->orderBy('id')->get();

        foreach ($rows as $row) {
            $code = (string) $row->product_model;
            if ($code === '') {
                continue;
            }

            $categoryLabel = $row->product_category
                ? CatalogLabels::category((string) $row->product_category)
                : '';

            if ($categoryLabel === '' || $categoryLabel === 'Semua Produk') {
                continue;
            }

            // Label model bisa berasal dari nama wadah itu sendiri, jadi dua
            // bentuk dihitung: label resmi dan bentuk judul dari kode.
            $modelLabels = array_values(array_unique(array_filter([
                CatalogLabels::model($code),
                CatalogLabels::titleCaseIndonesia($code),
            ])));

            $current = mb_strtolower(trim((string) $row->name));

            foreach ($modelLabels as $modelLabel) {
                $oldAuto = mb_strtolower($categoryLabel.' Aluminium '.$modelLabel);
                if ($current !== $oldAuto) {
                    continue;
                }

                // modelCardTitle sudah menangani label yang kebetulan
                // diawali nama kategori, supaya tidak jadi dobel.
                $row->update([
                    'name' => CatalogLabels::modelCardTitle((string) $row->product_category, $code),
                ]);
                break;
            }
        }

        // Label model disimpan di cache; nama yang baru diubah harus terbaca.
        foreach ($rows->pluck('product_model')->filter()->unique() as $code) {
            Cache::forget('catalog.model.label.'.strtolower((string) $code));
        }
    }

    public function down(): void
    {
        // Tidak dikembalikan: nama lama memuat asumsi material yang memang
        // ingin dilepas. Membaliknya akan mengembalikan data yang salah.
    }
};
