<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kontrak owner 2026-09-05: baris media_update tanpa gambar = dilewati
// (bukan gagal). Butuh status 'skipped' di import_job_rows.
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE import_job_rows MODIFY COLUMN status ENUM('pending','processed','success','failed','skipped') NOT NULL DEFAULT 'pending'");
        }
        // SQLite (test) menyimpan enum sebagai TEXT: tidak perlu ALTER.
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE import_job_rows MODIFY COLUMN status ENUM('pending','processed','success','failed') NOT NULL DEFAULT 'pending'");
        }
    }
};
