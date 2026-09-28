<?php

namespace App\Support;

use App\Services\ModelProductService;
use Illuminate\Support\Facades\Auth;
use Throwable;

/**
 * Penyelaras daftar wadah model produk (tabel `cms_model_products`).
 *
 * Sampai 2026-09-28 penyelarasan hanya berjalan saat admin menekan tombol
 * "Muat ulang katalog". Tombol itu dihapus atas keputusan owner ("hilangkan
 * saja, pastikan semuanya otomatis saja"), sehingga penyelarasan kini berjalan
 * sendiri: dipicu ProductObserver setiap kali produk yang menentukan wadah
 * berubah, dan sekali di akhir import katalog.
 *
 * Efek penyelarasan ada dua dan sengaja dibiarkan apa adanya: wadah baru
 * ditambahkan, dan wadah yang tidak lagi punya produk aktif dinonaktifkan.
 * Penyembunyian manual admin TIDAK dilawan (wadah nonaktif tidak diaktifkan
 * kembali), karena itu keputusan tampil atau tidaknya sebuah model di toko.
 */
final class ModelProductSync
{
    /** Hitungan penahan: selama > 0, perubahan produk tidak memicu penyelarasan. */
    private static int $ditahan = 0;

    /**
     * Selaraskan wadah dengan katalog sekarang. Aman dipanggil dari mana saja:
     * kegagalan penyelarasan dilaporkan, tidak pernah menggagalkan simpan
     * produk yang memicunya.
     */
    public static function sync(): void
    {
        if (self::$ditahan > 0) {
            return;
        }

        try {
            app(ModelProductService::class)->syncFromCatalog(
                Auth::id() !== null ? (int) Auth::id() : null
            );
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * Tahan penyelarasan per perubahan selama pekerjaan borongan berjalan,
     * supaya import seribu baris tidak menyelaraskan seribu kali. Pemanggil
     * wajib menyelaraskan sekali sendiri setelah pekerjaannya selesai.
     */
    public static function suppress(callable $kerja): mixed
    {
        self::$ditahan++;

        try {
            return $kerja();
        } finally {
            self::$ditahan--;
        }
    }
}
