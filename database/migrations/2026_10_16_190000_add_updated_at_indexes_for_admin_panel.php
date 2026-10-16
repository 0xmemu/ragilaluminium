<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indeks updated_at untuk tabel yang tampil di panel admin (Tahap 2 live events).
 *
 * Kenapa: penanda versi panel dulu membaca MAX(updated_at) pada sekitar sepuluh
 * tabel, dan kolom itu tidak berindeks sama sekali. Begitu pesanan bertambah,
 * setiap pembacaan berubah menjadi pemindaian tabel penuh.
 *
 * Setelah Tahap 2, penanda versi dipindah ke Redis sehingga kolom ini tidak lagi
 * di jalur polling. Indeks tetap ditambahkan karena daftar admin mengurutkan dan
 * menyaring berdasarkan waktu, dan itu akan terasa saat data bertambah.
 *
 * Forward-only: hanya menambah indeks, tidak mengubah atau menghapus data.
 * Memakai Schema::getIndexes() agar portabel (MySQL produksi dan SQLite tes).
 */
return new class extends Migration
{
    /** @var array<int, string> */
    private array $tabel = [
        'orders',
        'whatsapp_messages',
        'media_assets',
        'import_jobs',
        'order_return_cases',
        'payments',
        'cms_testimonials',
        'cms_banners',
        'announcements',
        'store_vouchers',
        'promotions',
        'shipping_records',
        'admin_notifications',
    ];

    public function up(): void
    {
        foreach ($this->tabel as $nama) {
            if (! Schema::hasTable($nama) || ! Schema::hasColumn($nama, 'updated_at')) {
                continue;
            }

            if ($this->sudahAdaIndeks($nama, 'updated_at')) {
                continue;
            }

            Schema::table($nama, function (Blueprint $table) {
                $table->index('updated_at');
            });
        }
    }

    /**
     * Indeks tidak dihapus saat rollback: menghapusnya bisa memengaruhi query
     * yang memakainya, sedangkan menambahkannya kembali murah. Migrasi ini
     * sengaja satu arah.
     */
    public function down(): void
    {
        // Sengaja kosong.
    }

    private function sudahAdaIndeks(string $tabel, string $kolom): bool
    {
        try {
            foreach (Schema::getIndexes($tabel) as $indeks) {
                if (in_array($kolom, $indeks['columns'] ?? [], true)) {
                    return true;
                }
            }
        } catch (\Throwable) {
            // Bila introspeksi tidak tersedia, biarkan pembuatan indeks mencoba;
            // kalau sudah ada, MySQL akan menolak dan migrasi ini idempoten.
        }

        return false;
    }
};
