<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ID kategori Shopee dihapus dari alur admin (keputusan owner 2026-09-03).
        // Kolom dipertahankan (nullable) agar data historis tetap utuh; tidak
        // lagi wajib diisi saat membuat/mengubah produk.
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('category_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('category_id')->nullable(false)->change();
        });
    }
};
