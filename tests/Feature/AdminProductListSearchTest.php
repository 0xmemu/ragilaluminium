<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Pencarian daftar produk admin (/admin/kelola/produk).
 *
 * Kontrak kotak cari: "Cari nama produk atau SKU Induk". Pencarian hanya
 * menyentuh yang TERLIHAT di daftar: nama produk, nama pendek, SKU induk, dan
 * taksonomi (kategori, model, sub model). Kolom dimensi varian adalah data
 * pengiriman yang tidak tampil, jadi tidak boleh ikut dicari.
 *
 * Ukuran tetap bisa dicari karena tertulis di nama produk, misalnya "(80x50)".
 */
class AdminProductListSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Category::firstOrCreate(['code' => 'JENDELA'], ['name' => 'Jendela', 'slug' => 'jendela', 'sort_order' => 1, 'is_active' => true]);
        Category::firstOrCreate(['code' => 'BOVEN'], ['name' => 'Boven', 'slug' => 'boven', 'sort_order' => 2, 'is_active' => true]);

        CmsModelProduct::firstOrCreate([
            'name' => 'Jendela Sliding',
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'active',
            'sort_order' => 1,
        ]);
        CmsModelProduct::firstOrCreate([
            'name' => 'Boven Jungkit',
            'product_category' => 'BOVEN',
            'product_model' => 'JUNGKIT',
            'status' => 'active',
            'sort_order' => 2,
        ]);

        SubModel::firstOrCreate(['product_model' => 'SLIDING', 'code' => 'ORNAMEN', 'name' => 'Ornamen', 'is_active' => true]);
        SubModel::firstOrCreate(['product_model' => 'JUNGKIT', 'code' => 'POLOS', 'name' => 'Polos', 'is_active' => true]);
    }

    /**
     * Produk dengan dimensi packing yang SENGAJA berbeda dari ukuran di nama,
     * meniru katalog nyata: nama "(80x50)", kolom dimensi 85x55.
     */
    private function product(
        string $sku,
        string $name,
        string $category = 'JENDELA',
        string $model = 'SLIDING',
        string $design = 'ORNAMEN',
        ?float $height = null,
        ?float $width = null,
    ): Product {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => $name,
            'short_name' => $name,
            'category_id' => 1,
            'product_category' => $category,
            'product_model' => $model,
            'design_variant' => $design,
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
            'depth_cm' => $height === null ? null : 12,
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
        // Nama memuat ukuran jadi 80x50; kolom dimensi menyimpan 85x55.
        $this->product(
            'RAYX8Y67W2UM',
            'Tinggi 80 cm x Panjang 50 cm (80x50) Jendela Aluminium Sliding Ornamen',
            'JENDELA',
            'SLIDING',
            'ORNAMEN',
            85,
            55,
        );

        // Nama tidak memuat kata taksonomi apa pun: hanya bisa ketemu lewat taksonomi.
        $this->product('RABOVEN2P90', 'Pintu 2 Daun 90 cm Aluminium', 'BOVEN', 'JUNGKIT', 'POLOS');
        $this->product('RAJENDELA01', 'Rangka Aluminium Dasar', 'JENDELA', 'SLIDING', 'ORNAMEN');
    }

    public function test_kata_kunci_nama_produk_dicari(): void
    {
        $this->seedProducts();

        // Ketiga kata ini juga cocok ke RAJENDELA01 lewat taksonomi, jadi
        // yang diuji adalah produknya ikut muncul, bukan jumlah hasil.
        $this->assertContains('RAYX8Y67W2UM', $this->search('jendela aluminium sliding ornamen'));
        $this->assertContains('RAYX8Y67W2UM', $this->search('(80x50) sliding'));
    }

    public function test_kata_kunci_nama_berangka_tetap_dicari(): void
    {
        $this->seedProducts();

        $this->assertSame(['RABOVEN2P90'], $this->search('pintu 2 daun'));
        $this->assertSame(['RABOVEN2P90'], $this->search('90 cm aluminium'));
    }

    public function test_sku_induk_berangka_tetap_dicari(): void
    {
        $this->seedProducts();

        $this->assertSame(['RAYX8Y67W2UM'], $this->search('RAYX8Y67W2UM'));
        $this->assertSame(['RABOVEN2P90'], $this->search('RABOVEN2P90'));
    }

    public function test_ukuran_yang_tertulis_di_nama_produk_ditemukan(): void
    {
        $this->seedProducts();

        $this->assertSame(['RAYX8Y67W2UM'], $this->search('80x50'));
        $this->assertSame(['RAYX8Y67W2UM'], $this->search('(80x50)'));
        $this->assertSame(['RAYX8Y67W2UM'], $this->search('Tinggi 80 x Panjang 50'));
    }

    public function test_dimensi_packing_tidak_ikut_dicari(): void
    {
        $this->seedProducts();

        // 85x55 hanya ada di kolom height_cm/width_cm, tidak tampil di daftar.
        $this->assertSame([], $this->search('85x55'));

        // Orientasi terbalik juga tidak boleh menemukan lewat kolom tersembunyi.
        $this->assertSame([], $this->search('55x85'));
    }

    public function test_taksonomi_kategori_dicari(): void
    {
        $this->seedProducts();

        // "Rangka Aluminium Dasar" tidak memuat kata jendela; ketemu lewat kategori.
        $this->assertContains('RAJENDELA01', $this->search('jendela'));
        $this->assertContains('RABOVEN2P90', $this->search('boven'));
    }

    public function test_taksonomi_model_dicari(): void
    {
        $this->seedProducts();

        $this->assertContains('RABOVEN2P90', $this->search('jungkit'));
        $this->assertSame(['RABOVEN2P90'], $this->search('jungkit'));
    }

    public function test_taksonomi_sub_model_dicari(): void
    {
        $this->seedProducts();

        // "Rangka Aluminium Dasar" memakai sub model ORNAMEN.
        $this->assertContains('RAJENDELA01', $this->search('ornamen'));
        $this->assertContains('RABOVEN2P90', $this->search('polos'));
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

        $response = $this->actingAs($this->admin)
            ->get(route('admin.products.export', ['q' => '80x50']));

        $response->assertOk();
        $this->assertSame(
            'attachment; filename=produk-'.now()->format('Ymd-His').'.xlsx',
            $response->headers->get('content-disposition'),
        );
    }
}
