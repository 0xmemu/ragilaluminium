<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'search_keywords')) {
            Schema::table('products', function (Blueprint $table) {
                // Catatan: TIDAK pakai index biasa pada kolom TEXT (MySQL butuh
                // prefix length; skala saat ini cukup LIKE tanpa index).
                $table->text('search_keywords')->nullable()->after('short_name');
            });
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('search_keywords');
        });
    }
};