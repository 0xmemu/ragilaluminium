<?php

namespace App\Console\Commands;

use App\Models\MediaUploadIntent;
use Illuminate\Console\Command;

/**
 * Tutup niat unggah yang tidak pernah memberi kabar, lalu pangkas yang lama.
 *
 * Dua hal dikerjakan, keduanya idempoten:
 *
 * 1. Niat berstatus `uploading` yang umurnya melewati batas ditandai
 *    `disconnected`. Ini kasus tab ditutup atau koneksi putus: peramban tidak
 *    pernah mengabari server, sehingga tanpa penyapu ini barisnya menggantung
 *    selamanya dan admin tidak pernah tahu berkas itu perlu diunggah ulang.
 *
 * 2. Niat yang lebih tua dari masa retensi dihapus. Tabel ini alat bantu
 *    operasional, bukan buku besar audit: catatan yang sudah tidak relevan
 *    sebaiknya tidak menumpuk.
 *
 * Batas waktu dan retensi dibaca dari config `media.*` supaya bisa diubah tanpa
 * menyentuh kode.
 */
class CloseStaleUploadIntents extends Command
{
    protected $signature = 'media:close-stale-intents
                            {--minutes= : Batas umur niat berjalan (menit); bawaan dari config}
                            {--retention-days= : Umur maksimal catatan sebelum dipangkas; bawaan dari config}
                            {--dry-run : Hanya laporkan, tanpa mengubah data}';

    protected $description = 'Tandai niat unggah media yang tidak pernah selesai sebagai terputus, lalu pangkas catatan lama';

    public function handle(): int
    {
        // Batas bawah 5 menit supaya unggahan besar yang sedang berjalan tidak
        // keliru ditandai terputus hanya karena penyapu berjalan terlalu cepat.
        $menit = max(5, (int) ($this->option('minutes') ?: config('media.upload_intent_timeout_minutes', 30)));
        $retensiHari = max(1, (int) ($this->option('retention-days') ?: config('media.upload_intent_retention_days', 14)));
        $dryRun = (bool) $this->option('dry-run');

        $cutoff = now()->subMinutes($menit);
        $berjalan = MediaUploadIntent::query()
            ->where('status', MediaUploadIntent::STATUS_UPLOADING)
            ->where('created_at', '<', $cutoff);

        $jumlahBerjalan = (clone $berjalan)->count();

        $cutoffRetensi = now()->subDays($retensiHari);
        $jumlahLama = MediaUploadIntent::query()->where('created_at', '<', $cutoffRetensi)->count();

        if ($dryRun) {
            $this->info("[dry-run] niat terputus: {$jumlahBerjalan} (cutoff {$menit} menit)");
            $this->info("[dry-run] catatan kedaluwarsa: {$jumlahLama} (retensi {$retensiHari} hari)");

            return self::SUCCESS;
        }

        if ($jumlahBerjalan > 0) {
            $berjalan->update([
                'status' => MediaUploadIntent::STATUS_DISCONNECTED,
                'error_reason' => "Tidak ada kabar lebih dari {$menit} menit; unggahan hampir pasti terputus.",
                'updated_at' => now(),
            ]);
        }

        $dipangkas = $jumlahLama > 0
            ? MediaUploadIntent::query()->where('created_at', '<', $cutoffRetensi)->delete()
            : 0;

        $this->info("Niat ditandai terputus: {$jumlahBerjalan} (cutoff {$menit} menit).");
        $this->info("Catatan kedaluwarsa dipangkas: {$dipangkas} (retensi {$retensiHari} hari).");

        return self::SUCCESS;
    }
}
