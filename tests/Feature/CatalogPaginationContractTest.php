<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Katalog produk memakai PAGINATION BERNOMOR (kontrak owner 2026-09-16):
 * produk yang terlihat DIBATASI per halaman dan navigasi antar halaman memakai
 * nomor halaman. Tiap permintaan mengembalikan SATU halaman saja, jadi daftar
 * tidak menumpuk antar halaman.
 */
class CatalogPaginationContractTest extends TestCase
{
    use RefreshDatabase;
    use CreatesVisibleProducts;

    /** Buat $count produk visible dengan SKU berurutan agar mudah ditelusuri. */
    private function seedProducts(int $count, string $prefix): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->createVisibleProduct([
                'parent_sku' => $prefix.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
            ]);
        }
    }

    /** Ambil daftar parent_sku pada satu halaman listing (via assertInertia). */
    private function skusOnPage(string $url): array
    {
        $skus = [];

        $this->get($url)
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$skus) {
                $props = $page->toArray()['props'];
                $skus = collect($props['products'])->pluck('parent_sku')->all();
            });

        return $skus;
    }

    public function test_first_page_is_limited_to_one_batch(): void
    {
        $this->seedProducts(20, 'PG-A-');

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                // 20 produk, batch 15 -> halaman 1 hanya memuat 15 kartu.
                ->has('products', 15)
                ->where('pagination.current_page', 1)
                ->where('pagination.last_page', 2)
                ->where('pagination.total', 20)
                // Nomor halaman di UI dibangun dari links ini.
                ->has('pagination.links')
            );
    }

    public function test_next_page_returns_only_that_page_not_accumulated(): void
    {
        $this->seedProducts(20, 'PG-B-');

        $firstPage = $this->skusOnPage('/products/all');
        $secondPage = $this->skusOnPage('/products/all?page=2');

        // Halaman 2 = sisa batch (20 - 15 = 5 kartu), bukan 20 kartu menumpuk.
        $this->assertCount(15, $firstPage);
        $this->assertCount(5, $secondPage);
        // Tidak ada SKU yang muncul di kedua halaman.
        $this->assertSame([], array_intersect($firstPage, $secondPage));
    }

    public function test_last_page_holds_only_the_remainder(): void
    {
        // 81 produk (seperti hasil pencarian nyata) -> 6 halaman, terakhir 6 kartu.
        $this->seedProducts(81, 'PG-C-');

        $this->get('/products/all?page=6')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 6)
                ->where('pagination.current_page', 6)
                ->where('pagination.last_page', 6)
                ->where('pagination.total', 81)
            );
    }

    public function test_products_prop_is_plain_array_without_merge_metadata(): void
    {
        $this->seedProducts(3, 'PG-D-');

        // Respons Inertia penuh: bentuk prop harus array kartu datar, tanpa
        // penanda merge/scroll (daftar tidak di-append; navigasi = nomor halaman).
        $response = $this->get('/products/all', [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => (string) app(\App\Http\Middleware\HandleInertiaRequests::class)
                ->version(request()),
        ]);

        $response->assertOk();
        $payload = $response->json();

        $this->assertCount(3, $payload['props']['products']);
        $this->assertArrayNotHasKey('mergeProps', $payload);
        $this->assertArrayNotHasKey('scrollProps', $payload);
    }
}
