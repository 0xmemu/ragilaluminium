<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Cache layer katalog & PDP (P2-2.1).
 *
 * - Tag "products" utk invalidasi menyeluruh saat produk/varian berubah.
 * - TTL 5 menit; PDP & katalog query berat di-cache.
 * - Observer Product/Variant men-trigger flushProducts().
 */
final class ProductCache
{
    public const TTL = 300;

    private const TAGS = ['products'];

    /** Cache payload PDP per parent_sku (produk + relations). */
    public static function rememberPdp(string $parentSku, Closure $callback): mixed
    {
        return Cache::tags(self::TAGS)->remember('pdp:'.$parentSku, self::TTL, $callback);
    }

    /** Cache hasil katalog (paginator/products) per key unik. */
    public static function rememberCatalog(string $key, Closure $callback): mixed
    {
        return Cache::tags(self::TAGS)->remember('catalog:'.md5($key), self::TTL, $callback);
    }

    /** Hapus semua cache produk (dipanggil observer saat produk/varian berubah). */
    public static function flushProducts(): void
    {
        Cache::tags(self::TAGS)->flush();
    }
}