<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rapikan riwayat pemrosesan media agar satu pekerjaan meninggalkan satu baris.
 *
 * Sebelum 14 Okt 2026 setiap tahap pemrosesan MENAMBAH baris barunya sendiri
 * (antre, lalu diproses, lalu berhasil) dan tidak pernah memperbarui baris lama.
 * Akibatnya halaman Riwayat Media menumpuk baris "Diproses" yang pekerjaannya
 * sudah lama selesai: pada data produksi 14 Okt, 164 media meninggalkan 326
 * baris, dua baris per media. Angkanya lalu terbaca seperti masih banyak
 * pekerjaan berjalan, padahal tidak ada satu pun yang tersisa di antrean.
 *
 * Dua langkah, keduanya idempoten:
 *
 * 1. Sisakan hanya baris TERBARU per media. Baris terbaru itulah status yang
 *    berlaku: "Berhasil" untuk pekerjaan yang selesai, "Diproses" untuk yang
 *    benar-benar masih berjalan.
 * 2. Buang baris yang statusnya masih berjalan padahal medianya sudah tidak ada.
 *    Status sementara untuk media yang sudah dihapus tidak akan pernah selesai,
 *    jadi ia bukan status, melainkan sisa yang menyesatkan.
 *
 * Sesudah ini, penulis log memakai MediaProcessingLog::transition() yang
 * memperbarui baris berjalan alih-alih menambah baris baru, sehingga penumpukan
 * tidak terulang.
 *
 * Tidak ada down(): baris yang sudah digabungkan tidak bisa dipulihkan, dan
 * menggabungkannya kembali memang tujuan migrasi ini.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Sisakan baris terbaru per entitas. Subquery dibungkus tabel turunan
        //    karena MySQL melarang menghapus dari tabel yang sedang dibaca.
        DB::statement('
            DELETE FROM media_processing_logs
            WHERE id NOT IN (
                SELECT id FROM (
                    SELECT MAX(id) AS id
                    FROM media_processing_logs
                    GROUP BY loggable_type, loggable_id
                ) AS terbaru
            )
        ');

        // 2. Buang status berjalan milik media yang sudah tidak ada.
        foreach ([
            ['App\\Models\\MediaAsset', 'media_assets'],
            ['App\\Models\\ProductMedia', 'product_media'],
        ] as [$morph, $tabel]) {
            if (! DB::getSchemaBuilder()->hasTable($tabel)) {
                continue;
            }

            DB::table('media_processing_logs')
                ->whereIn('event', ['queued', 'processing'])
                ->where('loggable_type', $morph)
                ->whereNotIn('loggable_id', function ($q) use ($tabel) {
                    $q->select('id')->from($tabel);
                })
                ->delete();
        }
    }

    public function down(): void
    {
        // Sengaja kosong: penggabungan baris tidak bisa dibalik.
    }
};
