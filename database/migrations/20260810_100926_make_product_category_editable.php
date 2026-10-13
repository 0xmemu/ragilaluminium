<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Relax the fixed enum so new categories can be added.
        // Only needed on MySQL; SQLite test DB doesn't use the enum constraint.
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE products MODIFY product_category VARCHAR(50) NOT NULL DEFAULT 'WINDOW'");
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE products MODIFY product_category ENUM('WINDOW','DOOR','BOUVEN') NOT NULL");
        }
    }
};
