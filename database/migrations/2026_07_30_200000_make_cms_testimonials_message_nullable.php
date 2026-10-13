<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Production MySQL: allow screenshot-only testimonials (message optional).
 * Fresh installs already get nullable message from create_cms_tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE cms_testimonials MODIFY message TEXT NULL');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("UPDATE cms_testimonials SET message = '' WHERE message IS NULL");
        DB::statement('ALTER TABLE cms_testimonials MODIFY message TEXT NOT NULL');
    }
};
