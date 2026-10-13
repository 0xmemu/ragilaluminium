<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotion_items', function (Blueprint $table) {
            // Target sub model presisi: pasangan (model, kode sub model).
            // Null = target sub model global semua model (back-compat).
            $table->string('target_model')->nullable()->after('target_id');
        });
    }

    public function down(): void
    {
        Schema::table('promotion_items', function (Blueprint $table) {
            $table->dropColumn('target_model');
        });
    }
};
