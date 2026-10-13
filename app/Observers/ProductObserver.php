<?php

namespace App\Observers;

use App\Models\Product;
use App\Support\ModelProductSync;
use App\Support\ProductCache;

/**
 * Invalidate cache katalog/PDP saat produk berubah (create/update/delete),
 * dan selaraskan wadah model produk (`cms_model_products`).
 *
 * Penyelarasan wadah dipicu di sini sejak 2026-09-28 (keputusan owner: tombol
 * "Muat ulang katalog" dihapus, semuanya otomatis). Hanya perubahan yang
 * memengaruhi wadah yang memicunya: kategori produk, kode model, dan status.
 * Perubahan lain (harga, stok, deskripsi) tidak menyentuh daftar wadah.
 * Pekerjaan borongan seperti import katalog menahan pemicu ini lewat
 * ModelProductSync::suppress lalu menyelaraskan sekali di akhir.
 */
class ProductObserver
{
    public function created(Product $product): void
    {
        $this->segarkanTurunan($product);

        // Pasangan kategori + model baru selalu perlu wadah.
        ModelProductSync::sync();
    }

    public function updated(Product $product): void
    {
        $this->segarkanTurunan($product);

        // Hanya perubahan yang menentukan wadah yang memicu penyelarasan.
        // Dipisah dari event created karena wasRecentlyCreated tetap bernilai
        // true pada instance yang sama, sehingga update biasa akan salah
        // dianggap penambahan.
        if ($product->wasChanged(['product_category', 'product_model', 'status'])) {
            ModelProductSync::sync();
        }
    }

    public function deleted(Product $product): void
    {
        ProductCache::flushProducts();

        // Produk yang dihapus bisa jadi satu-satunya produk aktif sebuah model,
        // jadi wadahnya perlu dinonaktifkan.
        ModelProductSync::sync();
    }

    private function segarkanTurunan(Product $product): void
    {
        app(\App\Support\ProductSearchKeywordService::class)->generate($product);

        ProductCache::flushProducts();
    }
}