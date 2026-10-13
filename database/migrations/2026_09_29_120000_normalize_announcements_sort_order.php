<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Nomor urut bar promo dimulai dari 1, bukan 0.
 *
 * Nilai lama tersimpan 0-based (0, 1, 2, ...) dan angka itu tampil apa adanya di
 * kolom "Urutan" halaman Bar Promo, sehingga baris teratas tertulis 0. Seluruh
 * baris digeser serentak supaya nilai terkecil menjadi 1; urutan relatifnya tidak
 * berubah karena semua baris bergeser dengan jumlah yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        $terkecil = DB::table('announcements')->min('sort_order');

        if ($terkecil !== null && (int) $terkecil < 1) {
            DB::table('announcements')->increment('sort_order', 1 - (int) $terkecil);
        }
    }

    public function down(): void
    {
        $terkecil = DB::table('announcements')->min('sort_order');

        if ($terkecil !== null && (int) $terkecil >= 1) {
            DB::table('announcements')->decrement('sort_order', (int) $terkecil);
        }
    }
};
