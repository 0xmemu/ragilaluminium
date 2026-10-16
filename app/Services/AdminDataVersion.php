<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Penanda versi data panel admin.
 *
 * Menggantikan query agregat berisi 14 subquery yang dulu dijalankan pada SETIAP
 * polling notifikasi panel admin (tiap 8 detik per tab). Nilainya kini disimpan di
 * Redis dan hanya dinaikkan saat model yang tampil di panel berubah, sehingga
 * pembacaan menjadi satu operasi kunci alih-alih pemindaian sekitar sepuluh tabel.
 *
 * Kenapa penting: kolom updated_at tidak punya indeks, jadi begitu pesanan
 * bertambah, query lama berubah menjadi pemindaian tabel penuh pada setiap
 * polling. Dengan puluhan tab admin terbuka, itu beban yang tumbuh sendiri.
 *
 * Kontrak:
 * - bump() TIDAK PERNAH melempar. Kegagalan penanda tidak boleh menggagalkan
 *   penyimpanan data pelanggan. Kalau Redis bermasalah, penanda cukup diam.
 * - current() selalu mengembalikan string, dan jatuh ke perhitungan dari basis
 *   data bila Redis tidak terbaca, supaya panel tetap bekerja.
 */
class AdminDataVersion
{
    /** Kunci Redis penanda versi. */
    public const KEY = 'admin:data_version';

    public function current(): string
    {
        try {
            $nilai = Cache::get(self::KEY);
            if ($nilai !== null && $nilai !== '') {
                return (string) $nilai;
            }

            // Kunci belum ada (mis. Redis baru dikosongkan). Tanam nilai awal dari
            // basis data supaya nilainya tetap mencerminkan keadaan sebenarnya.
            $awal = $this->nilaiAwal();
            Cache::forever(self::KEY, $awal);

            return (string) $awal;
        } catch (\Throwable) {
            return $this->hitungDariBasisData();
        }
    }

    /**
     * Naikkan penanda. Dipanggil pengamat model pada setiap simpan atau hapus.
     * Sengaja menelan galat: penanda versi bukan data pelanggan, jadi kegagalannya
     * tidak boleh membatalkan transaksi penyimpanan.
     */
    public function bump(): void
    {
        try {
            if (Cache::get(self::KEY) === null) {
                Cache::forever(self::KEY, $this->nilaiAwal());
            }

            Cache::increment(self::KEY);
        } catch (\Throwable) {
            // Diabaikan dengan sengaja.
        }
    }

    /**
     * Nilai awal berupa bilangan. Wajib bilangan karena Redis INCR hanya bekerja
     * pada nilai numerik, sedangkan sidik jari basis data berbentuk teks.
     */
    private function nilaiAwal(): int
    {
        return (int) sprintf('%u', crc32($this->hitungDariBasisData()));
    }

    /**
     * Perhitungan dari basis data (perilaku lama, dipertahankan sebagai nilai awal
     * dan sebagai cadangan bila Redis tidak terbaca).
     */
    private function hitungDariBasisData(): string
    {
        $row = DB::selectOne(<<<'SQL'
            SELECT CONCAT_WS('|',
                COALESCE((SELECT MAX(id) FROM orders), 0),
                COALESCE((SELECT MAX(updated_at) FROM orders), ''),
                COALESCE((SELECT MAX(id) FROM whatsapp_messages), 0),
                COALESCE((SELECT MAX(updated_at) FROM whatsapp_messages), ''),
                COALESCE((SELECT MAX(updated_at) FROM media_assets), ''),
                COALESCE((SELECT MAX(updated_at) FROM import_jobs), ''),
                COALESCE((SELECT MAX(updated_at) FROM order_return_cases), ''),
                COALESCE((SELECT MAX(updated_at) FROM payments), ''),
                COALESCE((SELECT MAX(updated_at) FROM cms_testimonials), ''),
                COALESCE((SELECT MAX(updated_at) FROM cms_banners), ''),
                COALESCE((SELECT MAX(updated_at) FROM announcements), ''),
                COALESCE((SELECT MAX(updated_at) FROM store_vouchers), ''),
                COALESCE((SELECT MAX(updated_at) FROM promotions), ''),
                COALESCE((SELECT MAX(updated_at) FROM shipping_records), ''),
                COALESCE((SELECT MAX(id) FROM admin_notifications), 0)
            ) AS v
        SQL);

        return md5((string) ($row->v ?? ''));
    }
}
