<?php

namespace App\Support;

use App\Models\SubModel;

/**
 * Pendaftar taksonomi yang dipakai produk secara otomatis.
 *
 * Sejak 17 Okt 2026 impor katalog mendaftarkan Sub Model yang ditulis di
 * kolom XLSX ke tabel daftar `sub_models`. Tanpa ini, halaman Kelola Sub Model
 * tetap kosong walau produk sudah memakai sub model tersebut, sehingga admin
 * harus mengetik ulang satu per satu.
 *
 * Aturan yang dijaga:
 *  - Kosong tetap kosong. Model produk yang memang tidak punya sub model tidak
 *    membuat baris apa pun; kolom `design_variant` produk dibiarkan null.
 *  - Idempoten. Pasangan model + sub model yang sudah ada tidak diduplikasi.
 *  - Nama baris diambil dari label yang sama dengan dropdown admin, jadi
 *    "ORNAMEN" menjadi "Ornamen", bukan "ORNAMEN".
 */
final class ProductTaxonomyRegistrar
{
    /**
     * Daftarkan satu sub model. Mengembalikan baris yang dipakai (baru atau
     * yang sudah ada), atau null bila kode kosong.
     */
    public static function registerSubModel(?string $productModel, ?string $subModelCode): ?SubModel
    {
        $model = CatalogLabels::normalizeModel($productModel);
        $code = CatalogLabels::normalizeDesign($subModelCode);

        if ($model === null || $model === '' || $code === null || $code === '') {
            return null;
        }

        $existing = SubModel::query()
            ->where('product_model', $model)
            ->where('code', $code)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return SubModel::create([
            'product_model' => $model,
            'code' => $code,
            'name' => CatalogLabels::design($code) ?: CatalogLabels::titleCaseIndonesia($code),
            // Nomor urut melanjutkan yang terakhir untuk model ini, supaya sub
            // model baru tidak menyalip urutan yang sudah diatur admin.
            'sort_order' => (int) SubModel::query()->where('product_model', $model)->max('sort_order') + 10,
            'is_active' => true,
        ]);
    }
}
