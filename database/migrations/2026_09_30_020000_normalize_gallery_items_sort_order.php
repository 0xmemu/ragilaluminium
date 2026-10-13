<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nomor urut galeri foto (cms_gallery_items) mulai dari 1, bukan 0.
 *
 * Halaman galeri foto masih menyimpan urutan 0-based dan angkanya tampil di
 * field "Urutan" pada form galeri, jadi baris teratas terbaca 0. Seluruh baris
 * digeser serentak (increment 1 - min) supaya nilai terkecil menjadi 1; urutan
 * relatif tidak berubah karena semua baris bergeser dengan jumlah yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cms_gallery_items') || ! Schema::hasColumn('cms_gallery_items', 'sort_order')) {
            return;
        }

        $terkecil = DB::table('cms_gallery_items')->min('sort_order');

        if ($terkecil !== null && (int) $terkecil < 1) {
            DB::table('cms_gallery_items')->increment('sort_order', 1 - (int) $terkecil);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('cms_gallery_items') || ! Schema::hasColumn('cms_gallery_items', 'sort_order')) {
            return;
        }

        $terkecil = DB::table('cms_gallery_items')->min('sort_order');

        if ($terkecil !== null && (int) $terkecil >= 1) {
            DB::table('cms_gallery_items')->decrement('sort_order', (int) $terkecil);
        }
    }
};
