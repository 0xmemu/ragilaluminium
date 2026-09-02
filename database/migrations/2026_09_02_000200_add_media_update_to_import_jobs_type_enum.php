<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah jenis import media_update (Update Media) ke enum import_jobs.type.
     * Nilai legacy dipertahankan agar data lama tidak rusak. Dilewati untuk
     * sqlite (test) karena ENUM tidak didukung di sana.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }
        if (Schema::hasColumn('import_jobs', 'type')) {
            DB::statement(
                "ALTER TABLE import_jobs MODIFY type "
                . "ENUM('catalog_import','stock_price_update','media_update','internal_bulk_update','shopee_mass_upload','shopee_mass_update') NOT NULL"
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
                . "ENUM('catalog_import','stock_price_update','internal_bulk_update','shopee_mass_upload','shopee_mass_update') NOT NULL"
            );
        }
    }
};