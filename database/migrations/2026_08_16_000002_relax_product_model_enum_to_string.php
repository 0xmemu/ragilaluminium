<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Dynamic model: relaksasi enum products.product_model menjadi VARCHAR(50) sehingga
 * admin dapat menambah model baru tanpa harus memperbarui daftar enum tetap.
 * (SQLite tidak memakai constraint enum, jadi cukup untuk MySQL.)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE products MODIFY product_model VARCHAR(50) NOT NULL DEFAULT 'SLIDING'");
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE products MODIFY product_model ENUM('JUNGKIT','SLIDING','SWING','KACA_MATI','ZIGZAG') NOT NULL");
        }
    }
};
