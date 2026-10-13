<?php

namespace Tests\Feature;

use App\Jobs\ProcessCatalogImport;
use App\Models\ImportJob;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Sub model bersifat OPSIONAL.
 *
 * Sebuah model produk bisa punya nol, satu, atau banyak sub model. Boven Zigzag
 * contohnya hanya satu jenis, jadi tidak punya variasi desain sama sekali.
 * Sistem tidak boleh mengarang sub model "Polos" untuk produk semacam itu:
 * itu membuat model terlihat punya sub model lain padahal tidak ada, dan
 * memaksa produk masuk ke pengelompokan yang salah.
 *
 * Perilaku yang dijaga di sini: sub model kosong tetap kosong.
 */
class SubModelOptionalContractTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    /** Impor satu baris lalu kembalikan produknya. */
    private function importRow(array $row): Product
    {
        $rows = collect([$row]);
        $export = new class($rows) implements FromCollection, WithHeadings
        {
            public function __construct(public $rows) {}

            public function collection()
            {
                return $this->rows;
            }

            public function headings(): array
            {
                return array_keys($this->rows->first());
            }
        };
        Excel::store($export, 'submodel-optional.xlsx', 'imports');

        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => 'submodel-optional.xlsx',
            'source_file_path' => 'submodel-optional.xlsx',
            'status' => 'pending',
        ]);

        (new ProcessCatalogImport($job->id, 'submodel-optional.xlsx'))->handle();

        return Product::where('parent_sku', $row['parent_sku'])->firstOrFail();
    }

    public function test_impor_tanpa_design_variant_tidak_memaksa_polos(): void
    {
        $product = $this->importRow([
            'parent_sku' => 'ZIG-NOSUB-1',
            'name' => 'Boven Zigzag Satu Daun',
            'product_category' => 'BOVEN',
            'product_model' => 'ZIGZAG',
            'design_variant' => '',
            'variant_sku' => 'ZIG-NOSUB-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'image_1' => 'https://example.com/z.jpg',
            'weight_kg' => 10,
            'height_cm' => 50,
            'width_cm' => 150,
            'depth_cm' => 20,
        ]);

        $this->assertNull(
            $product->design_variant,
            'Sub model kosong harus tetap kosong, bukan diisi POLOS.',
        );
    }

    public function test_impor_dengan_sub_model_tetap_menyimpannya(): void
    {
        $product = $this->importRow([
            'parent_sku' => 'ZIG-WITHSUB-1',
            'name' => 'Jendela Swing Ornamen',
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            'variant_sku' => 'ZIG-WITHSUB-1-V1',
            'price' => 1000000,
            'stock' => 5,
            'image_1' => 'https://example.com/o.jpg',
            'weight_kg' => 10,
            'height_cm' => 100,
            'width_cm' => 50,
            'depth_cm' => 20,
        ]);

        $this->assertSame('ORNAMEN', $product->design_variant);
    }

    public function test_halaman_model_tanpa_sub_model_tetap_menampilkan_produk(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'ZIG-PAGE-1',
            'name' => 'Boven Zigzag Satu Daun',
            'product_category' => 'BOVEN',
            'product_model' => 'ZIGZAG',
            'design_variant' => null,
            'status' => 'active',
        ]);

        // Tanpa sub model tidak ada rail desain, TETAPI produknya harus tetap
        // terkirim ke halaman. Tanpa ini halaman menampilkan "Produk belum
        // tersedia" padahal produknya ada.
        $this->get(route('catalog.model', ['category' => 'boven', 'model' => 'zigzag']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelDetail')
                ->has('designRails', 0)
                ->has('products', 1)
                ->where('products.0.parent_sku', 'ZIG-PAGE-1')
            );
    }

    public function test_produk_tanpa_sub_model_tidak_dimasukkan_ke_rail_polos(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'MIX-POLOS-1',
            'name' => 'Sliding Polos',
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING_2_DAUN',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $this->createVisibleProduct([
            'parent_sku' => 'MIX-NULL-1',
            'name' => 'Sliding Tanpa Sub Model',
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING_2_DAUN',
            'design_variant' => null,
            'status' => 'active',
        ]);

        $this->get(route('catalog.model', ['category' => 'jendela', 'model' => 'sliding-2-daun']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ModelDetail')
                // Hanya satu rail (POLOS) berisi satu produk; produk tanpa sub
                // model tidak ikut tersedot ke dalamnya.
                ->has('designRails', 1)
                ->where('designRails.0.value', 'POLOS')
                ->where('designRails.0.count', 1)
            );
    }

    public function test_produk_tanpa_sub_model_tidak_muncul_di_filter_desain(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'NOSUB-FILTER-1',
            'name' => 'Zigzag Tanpa Sub Model',
            'product_category' => 'BOVEN',
            'product_model' => 'ZIGZAG',
            'design_variant' => null,
            'status' => 'active',
        ]);

        // Daftar desain pada taksonomi hanya berisi desain yang benar-benar
        // dipakai produk, jadi produk tanpa sub model tidak "menciptakan"
        // desain Polos di navigasi.
        $designs = \App\Support\CatalogTaxonomy::rows()
            ->where('product_model', 'ZIGZAG')
            ->pluck('design_variant')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $this->assertNotContains('POLOS', $designs);
    }

    public function test_storage_bersih_setelah_tes_impor(): void
    {
        Storage::disk('imports')->delete('submodel-optional.xlsx');
        $this->assertFalse(Storage::disk('imports')->exists('submodel-optional.xlsx'));
    }
}
