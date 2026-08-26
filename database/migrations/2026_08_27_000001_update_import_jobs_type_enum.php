<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Import job type sudah bergeser dari Shopee (shopee_mass_upload /
     * shopee_mass_update) ke impor katalog internal (catalog_import) dan
     * pembaruan harga-stok (stock_price_update). Controller memvalidasi
     * type in: catalog_import, stock_price_update, tapi kolom enum lama
     * belum diubah sehingga import gagal (QueryException data truncated).
     *
     * Redefinisi enum mempertahankan nilai legacy agar data lama tidak
     * rusak, sambil menambah nilai baru yang dipakai controller.
     * Dilewati untuk sqlite (test) karena ENUM tidak didukung di sana.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }
        if (Schema::hasColumn('import_jobs', 'type')) {
            DB::statement(
                "ALTER TABLE import_jobs MODIFY type "
                . "ENUM('catalog_import','stock_price_update','internal_bulk_update','shopee_mass_upload','shopee_mass_update') NOT NULL"
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }
        if (Schema::hasColumn('import_jobs', 'type')) {
            DB::statement(
                "ALTER TABLE import_jobs MODIFY type "
                . "ENUM('shopee_mass_upload','shopee_mass_update','internal_bulk_update') NOT NULL"
            );
        }
    }
};
