<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Pencarian daftar produk admin (/admin/kelola/produk).
 *
 * Kontrak kotak cari: "Cari nama produk atau SKU Induk". Pencarian teks harus
 * SELALU berjalan; ukuran hanya tambahan. Regresi yang dijaga: dulu ketikan
 * berangka (termasuk SKU induk) mematikan pencarian nama sehingga hasil kosong.
 */
class AdminProductListSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /** Produk dengan dimensi tersimpan berbeda 5 cm dari ukuran di namanya. */
    private function product(string $sku, string $name, ?float $height = null, ?float $width = null): Product
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => $name,
            'short_name' => $name,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-1',
            'price' => 500000,
            'stock' => 5,
            'weight_kg' => 8.8,
            'height_cm' => $height,
            'width_cm' => $width,
            'depth_cm' => 12,
            'status' => 'active',
        ]);

        return $product;
    }

    /** @return list<string> */
    private function search(string $q): array
    {
        $skus = [];

        $this->actingAs($this->admin)
            ->get(route('admin.products.index', ['q' => $q]))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$skus) {
                $skus = collect($page->toArray()['props']['products'])->pluck('parent_sku')->all();
            });

        return $skus;
    }

    public function seedProducts(): void
    {
        // Nama memakai ukuran jadi 80x50, kolom dimensi menyimpan 85x55.
        $this->product('RAYX8Y67W2UM', 'Tinggi 80 cm x Panjang 50 cm (80x50) Jendela Aluminium Sliding Ornamen', 85, 55);
        $this->product('RAJDYEY4LCC9', 'Tinggi 80 cm x Panjang 60 cm (80x60) Jendela Aluminium Sliding Ornamen', 85, 65);
        $this->product('RABOVEN2P90', 'Boven 2 Pintu 90 cm Jendela Aluminium Jungkit');
    }

    public function test_kata_kunci_nama_produk_tetap_dicari(): void
    {
        $this->seedProducts();

        $this->assertSame(
            ['RABOVEN2P90'],
            $this->search('boven'),
            'Kata kunci nama produk harus menemukan produknya.',
        );
    }

    public function test_kata_kunci_nama_yang_mengandung_angka_tetap_dicari(): void
    {
        $this->seedProducts();

        // Dulu "boven 2 pintu" dianggap ukuran 2x90 sehingga hasilnya kosong.
        $this->assertSame(['RABOVEN2P90'], $this->search('boven 2 pintu'));
        $this->assertSame(['RABOVEN2P90'], $this->search('jendela jungkit'));
    }

    public function test_sku_induk_berangka_tetap_dicari(): void
    {
        $this->seedProducts();

        // Dulu "RA4CL3SFNE" dibaca sebagai ukuran 4x3.
        $this->assertSame(['RAYX8Y67W2UM'], $this->search('RAYX8Y67W2UM'));
        $this->assertSame(['RABOVEN2P90'], $this->search('RABOVEN2P90'));
    }

    public function test_ukuran_yang_tertulis_di_nama_produk_ditemukan(): void
    {
        $this->seedProducts();

        // Inti keluhan: ukuran yang dibaca mata ada di nama, bukan di kolom dimensi.
        $this->assertSame(['RAYX8Y67W2UM'], $this->search('80x50'));
        $this->assertSame(['RAYX8Y67W2UM'], $this->search('Tinggi 80 x Panjang 50'));
    }

    public function test_ukuran_tersimpan_di_kolom_dimensi_tetap_ditemukan(): void
    {
        $this->seedProducts();

        // 85x55 adalah dimensi tersimpan, bukan angka di nama. Harus tetap cocok
        // supaya pencarian berbasis data pengiriman tidak hilang.
        $this->assertSame(['RAYX8Y67W2UM'], $this->search('85x55'));
    }

    public function test_orientasi_terbalik_tetap_ditemukan(): void
    {
        $this->seedProducts();

        $this->assertSame(['RAYX8Y67W2UM'], $this->search('50x80'));
    }

    public function test_pencarian_tanpa_hasil_tidak_mengembalikan_semua_produk(): void
    {
        $this->seedProducts();

        $this->assertSame([], $this->search('tidakadasamasekali'));
        $this->assertSame([], $this->search('999x999'));
    }

    public function test_ekspor_memakai_pencarian_yang_sama(): void
    {
        $this->seedProducts();

        // Regresi: ekspor pernah membaca kunci 'width'/'height' dari daftar
        // bernomor sehingga hasilnya selalu kosong.
        $response = $this->actingAs($this->admin)
            ->get(route('admin.products.export', ['q' => '80x50']));

        $response->assertOk();
        $this->assertSame(
            'attachment; filename=produk-'.now()->format('Ymd-His').'.xlsx',
            $response->headers->get('content-disposition'),
        );
    }
}
