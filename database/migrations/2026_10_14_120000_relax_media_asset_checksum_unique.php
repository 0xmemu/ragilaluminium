<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Longgarkan keunikan sidik jari berkas media.
 *
 * Kontrak owner 2026-10-14: satu berkas boleh dipakai lebih dari satu produk.
 * Admin toko sering sengaja memakai foto produk yang sama untuk dua produk yang
 * dimensinya berdekatan (mis. 120 cm dan 110 cm), dan tiap produk tetap harus
 * punya asetnya sendiri di foldernya masing-masing. Penolakan duplikat sekarang
 * hanya berlaku DI DALAM satu aksi unggah, di sisi klien.
 *
 * Selama kolom `checksum` masih unik, dua aset dengan isi identik tidak mungkin
 * disimpan sama sekali: percobaan menyimpannya gagal dengan pelanggaran
 * keunikan. Jadi keunikannya dilepas di sini dan diganti indeks biasa, supaya
 * pencarian berdasarkan sidik jari (dipakai pencarian media dan impor) tetap
 * cepat tanpa melarang duplikat.
 *
 * `source_url_hash` SENGAJA tidak diubah: kolom itu dipakai jalur impor untuk
 * memakai ulang media dari URL sumber yang sama, sehingga berkas tidak diunduh
 * berkali-kali. Berkas yang diunggah manual tidak mengisi kolom itu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_assets', function (Blueprint $table) {
            $table->dropUnique('media_assets_checksum_unique');
            $table->index('checksum', 'idx_media_assets_checksum');
        });
    }

    public function down(): void
    {
        Schema::table('media_assets', function (Blueprint $table) {
            $table->dropIndex('idx_media_assets_checksum');
            $table->unique('checksum', 'media_assets_checksum_unique');
        });
    }
};
