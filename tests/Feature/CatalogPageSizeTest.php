<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Ukuran halaman katalog menyesuaikan lebar layar (kontrak owner 2026-09-18).
 *
 * Jumlah kartu per halaman dihitung SERVER, jadi server tidak bisa tahu lebar
 * layar. Klien mengirim `per_page` saat viewport sempit; desktop memakai default
 * config (15 kartu, pas untuk grid 3 dan 5 kolom), mobile 16 kartu (8 baris
 * penuh pada grid 2 kolom, tanpa kartu menggantung).
 */
class CatalogPageSizeTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    private function seedProducts(int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->createVisibleProduct([
                'parent_sku' => 'PP-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
            ]);
        }
    }

    public function test_desktop_memakai_ukuran_default_config(): void
    {
        $this->seedProducts(20);

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 15)
                ->where('pagination.per_page', 15)
                ->where('pagination.last_page', 2)
            );
    }

    public function test_mobile_meminta_ukuran_lebih_besar_lewat_per_page(): void
    {
        $this->seedProducts(20);

        $this->get('/products/all?per_page=16')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 16)
                ->where('pagination.per_page', 16)
                ->where('pagination.last_page', 2)
            );
    }

    public function test_ukuran_halaman_disajikan_ke_klien(): void
    {
        $this->seedProducts(3);

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('catalogPageSize.desktop', 15)
                ->where('catalogPageSize.mobile', 16)
            );
    }

    public function test_per_page_di_luar_ukuran_resmi_diabaikan(): void
    {
        $this->seedProducts(20);

        // URL yang menyisipkan per_page sembarang tidak boleh bisa memaksa
        // pagination raksasa; halaman kembali ke ukuran default.
        foreach (['1000', '0', '7', 'abc', '-5'] as $value) {
            $this->get('/products/all?per_page='.$value)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->has('products', 15)
                    ->where('pagination.per_page', 15)
                );
        }
    }

    public function test_ukuran_mobile_tidak_tercampur_cache_dengan_desktop(): void
    {
        $this->seedProducts(20);

        // Permintaan ukuran desktop dulu, lalu mobile: hasilnya tidak boleh
        // bertukar lewat cache katalog (kunci cache memuat ukuran halaman).
        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('products', 15));

        $this->get('/products/all?per_page=16')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('products', 16));

        // Kembali ke desktop: 15 kartu lagi, bukan sisa hasil mobile.
        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('products', 15));
    }

    public function test_halaman_terakhir_mobile_memuat_sisa_kartu(): void
    {
        $this->seedProducts(20);

        // 20 produk / 16 = halaman 2 berisi 4 kartu.
        $this->get('/products/all?per_page=16&page=2')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 4)
                ->where('pagination.current_page', 2)
                ->where('pagination.last_page', 2)
            );
    }

    public function test_api_katalog_ikut_memakai_ukuran_halaman(): void
    {
        $this->seedProducts(20);

        $this->getJson('/api/catalog/windows')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 15);

        $this->getJson('/api/catalog/windows?per_page=16')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 16)
            ->assertJsonCount(16, 'products');
    }
}
