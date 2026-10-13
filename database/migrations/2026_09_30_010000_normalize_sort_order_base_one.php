<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nomor urut di panel admin dimulai dari 1, bukan 0.
 *
 * Lanjutan dari migrasi announcements (2026_09_29_120000). Tiga tabel ini punya
 * kolom "Urutan" yang tampil ke admin, dan nilainya masih 0-based sehingga baris
 * teratas tertulis 0:
 *   - cms_banners            -> kolom "Urutan" di daftar Banner Promo
 *   - cms_problems_solutions -> kolom "Urutan tampil" di form Masalah & Solusi
 *   - categories             -> kolom "Urutan" di daftar Kategori
 *
 * Setiap tabel digeser serentak (increment 1 - min) supaya nilai terkecil menjadi
 * 1. Urutan relatif tidak berubah karena semua baris bergeser dengan jumlah yang
 * sama, dan seluruh konsumen hanya memakai ORDER BY sort_order.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $tabel = ['cms_banners', 'cms_problems_solutions', 'categories'];

    public function up(): void
    {
        foreach ($this->tabel as $tabel) {
            if (! Schema::hasTable($tabel) || ! Schema::hasColumn($tabel, 'sort_order')) {
                continue;
            }

            $terkecil = DB::table($tabel)->min('sort_order');

            if ($terkecil !== null && (int) $terkecil < 1) {
                DB::table($tabel)->increment('sort_order', 1 - (int) $terkecil);
            }
        }
    }

    public function down(): void
    {
        foreach ($this->tabel as $tabel) {
            if (! Schema::hasTable($tabel) || ! Schema::hasColumn($tabel, 'sort_order')) {
                continue;
            }

            $terkecil = DB::table($tabel)->min('sort_order');

            if ($terkecil !== null && (int) $terkecil >= 1) {
                DB::table($tabel)->decrement('sort_order', (int) $terkecil);
            }
        }
    }
};
