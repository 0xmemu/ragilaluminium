<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SPESIFIKASI-FINAL §A-21: status produk hanya active | archived (tanpa draft/inactive).
        Schema::table('products', function (Blueprint $table) {
            $table->enum('status', ['active', 'archived'])->default('active')->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->enum('status', ['active', 'inactive', 'archived', 'draft'])->default('draft')->change();
        });
    }
};
