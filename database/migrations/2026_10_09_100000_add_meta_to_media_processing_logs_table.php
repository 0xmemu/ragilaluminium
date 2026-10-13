<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Menambah kolom `meta` pada riwayat pemrosesan media.
 *
 * Latar masalah: pesan log penggabungan duplikat berbunyi "File identik dengan
 * aset lain", tetapi tabel ini tidak punya tempat menyimpan aset TUJUannya.
 * Sidik jari si duplikat pun tidak disimpan saat diarsipkan, jadi dari tabel ini
 * tidak bisa ditelusuri ke mana berkas kembar pergi, dan halaman Riwayat Media
 * hanya bisa memberi tahu BAHWA sesuatu dianggap duplikat, bukan ke mana perginya.
 *
 * Keputusan owner 2026-10-09: simpan id DAN label aset tujuan. Labelnya disimpan
 * bersama id supaya catatannya tetap terbaca walau aset tujuan kelak dihapus,
 * karena id saja akan menyisakan baris yang menunjuk ke sesuatu yang tidak ada.
 *
 * Bentuk JSON-nya sekitar: {"merged_into_asset_id": 953, "merged_into_label": "banner_4_20260910"}.
 * Kolomnya nullable dan JSON (bukan kolom terpisah per kejadian) supaya kejadian
 * lain yang butuh keterangan tambahan tidak menuntut migrasi baru lagi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_processing_logs', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('message');
        });
    }

    public function down(): void
    {
        Schema::table('media_processing_logs', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
    }
};
