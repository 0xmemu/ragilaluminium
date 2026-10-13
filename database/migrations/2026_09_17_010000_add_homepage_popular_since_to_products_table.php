<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Penanda kapan sebuah produk masuk jendela carousel "Paling Banyak Dipesan"
 * (10 teratas urutan). Dipakai halaman /admin/beranda/paling-banyak-dipesan
 * untuk membandingkan views & clicks SEBELUM vs SESUDAH produk jadi carousel:
 * - sesudah : sejak homepage_popular_since sampai sekarang
 * - sebelum : rentang sama panjang tepat sebelum tanggal itu
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->timestamp('homepage_popular_since')->nullable()->after('homepage_popular_sort');
        });

        // Backfill: produk yang saat ini sudah di jendela carousel dianggap masuk
        // sejak perubahan terakhirnya, supaya pembanding views/clicks langsung ada
        // dan tidak menunggu simpan berikutnya.
        DB::table('products')
            ->where('homepage_popular', true)
            ->whereNull('homepage_popular_since')
            ->update(['homepage_popular_since' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('homepage_popular_since');
        });
    }
};
