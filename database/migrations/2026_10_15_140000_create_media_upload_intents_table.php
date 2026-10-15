<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catatan niat unggah media ("upload intent").
 *
 * Latar masalah (owner 2026-10-15): bila tab atau jendela ditutup di tengah
 * unggahan, permintaan unggah dibatalkan peramban dan SERVER TIDAK PUNYA CATATAN
 * APA PUN. Admin tidak tahu berkas mana yang gagal, dan tidak ada cara mencoba
 * ulang selain menebak. Berkas yang benar-benar sampai pun baru tercatat setelah
 * seluruh isinya diterima server.
 *
 * Tabel ini mencatat niat SEBELUM byte bergerak. Satu baris = satu berkas dalam
 * satu aksi unggah:
 *   uploading    -> klien sudah menyatakan niat, hasilnya belum diketahui
 *   done         -> berkas diterima; media_asset_id menunjuk asetnya
 *   failed       -> server menolak (mis. tipe/ukuran); error_reason berisi sebabnya
 *   disconnected -> tidak ada kabar sampai batas waktu; hampir pasti tab ditutup
 *                   atau koneksi putus di tengah jalan
 *
 * Status sengaja varchar, bukan enum, mengikuti konvensi kolom
 * `media_processing_logs.event`: menambah status baru tidak menuntut migrasi ALTER.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_upload_intents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('folder_id')->nullable()->constrained('media_folders')->nullOnDelete();
            // Penanda satu aksi unggah, supaya baris bisa dikelompokkan di layar.
            $table->string('client_batch_id', 64);
            $table->string('file_name');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('checksum', 64)->nullable();
            $table->string('status', 20)->default('uploading');
            $table->foreignId('media_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('error_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at'], 'media_upload_intents_status_created_idx');
            $table->index(['user_id', 'client_batch_id'], 'media_upload_intents_user_batch_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_upload_intents');
    }
};
