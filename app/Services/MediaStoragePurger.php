<?php

namespace App\Services;

use App\Models\MediaAsset;
use App\Models\ProductMedia;
use Illuminate\Support\Facades\Storage;

/**
 * Satu pintu untuk menghapus berkas media di disk (lokal atau R2).
 *
 * Sebelum ini logika hapus tersebar di beberapa tempat: satu method privat di
 * ProductMediaController untuk aset library, satu blok inline di destroy
 * lampiran produk, dan dua blok inline di aksi massal media produk. Setiap
 * jalur baru yang lupa memanggilnya meninggalkan object yatim di bucket, dan
 * object yatim tidak bisa dilacak lagi karena barisnya sudah terhapus. Service
 * ini mengumpulkan seluruh key milik sebuah aset (object_key plus semua varian
 * derivatif) lalu menghapusnya dengan aman.
 */
class MediaStoragePurger
{
    /**
     * Varian derivatif yang mungkin dimiliki sebuah aset atau lampiran.
     */
    private const VARIANTS = ['thumb', 'card', 'pdp', 'poster', 'video'];

    /**
     * Kumpulkan seluruh key penyimpanan milik sebuah aset media.
     *
     * @return list<string>
     */
    public function keysForAsset(MediaAsset $asset): array
    {
        $keys = [];
        $derivatives = is_array($asset->derivatives) ? $asset->derivatives : [];

        foreach (self::VARIANTS as $variant) {
            $path = $derivatives[$variant]['path'] ?? null;
            if (is_string($path) && $path !== '') {
                $keys[] = $path;
            }
        }

        if (is_string($asset->object_key) && $asset->object_key !== '') {
            $keys[] = $asset->object_key;
        }

        return array_values(array_unique($keys));
    }

    /**
     * Kumpulkan seluruh key penyimpanan milik satu lampiran produk.
     *
     * @return list<string>
     */
    public function keysForAttachment(ProductMedia $media): array
    {
        $keys = [];
        $derivatives = is_array($media->derivatives) ? $media->derivatives : [];

        foreach (self::VARIANTS as $variant) {
            $path = $derivatives[$variant]['path'] ?? null;
            if (is_string($path) && $path !== '') {
                $keys[] = $path;
            }
        }

        if (is_string($media->stored_path) && $media->stored_path !== '') {
            $keys[] = $media->stored_path;
        }

        return array_values(array_unique($keys));
    }

    /**
     * Hapus berkas milik sebuah aset media.
     *
     * @return list<string> key yang benar-benar terhapus
     */
    public function purgeAsset(MediaAsset $asset): array
    {
        return $this->purgeKeys($this->keysForAsset($asset));
    }

    /**
     * Hapus berkas milik sebuah lampiran produk.
     *
     * @return list<string> key yang benar-benar terhapus
     */
    public function purgeAttachment(ProductMedia $media): array
    {
        return $this->purgeKeys($this->keysForAttachment($media));
    }

    /**
     * Hapus daftar key. Key yang tidak ada dilewati tanpa galat supaya
     * pembersihan tetap berjalan walau sebagian berkas sudah hilang lebih dulu.
     *
     * @param  iterable<int, string>  $keys
     * @return list<string> key yang benar-benar terhapus
     */
    public function purgeKeys(iterable $keys): array
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $deleted = [];

        foreach ($keys as $key) {
            if (! is_string($key) || $key === '') {
                continue;
            }

            try {
                if ($disk->exists($key)) {
                    $disk->delete($key);
                    $deleted[] = $key;
                }
            } catch (\Throwable $e) {
                // Kegagalan satu berkas tidak boleh menghentikan sisanya dan
                // tidak boleh menggagalkan penghapusan baris DB.
                report($e);
            }
        }

        return $deleted;
    }
}
