<?php

namespace Tests\Feature;

use App\Imports\ImportStockPriceUpdate;
use App\Jobs\ProcessCatalogImport;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\StockCellParser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class RandomStockImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_parser_resolves_number_random_and_empty(): void
    {
        $this->assertSame(8000, StockCellParser::resolve('8000'));
        $this->assertNull(StockCellParser::resolve(''));
        $this->assertNull(StockCellParser::resolve(null));

        for ($i = 0; $i < 20; $i++) {
            $value = StockCellParser::resolve('random 8000-9000');
            $this->assertGreaterThanOrEqual(8000, $value);
            $this->assertLessThanOrEqual(9000, $value);
        }
    }

    public function test_parser_rejects_invalid_random_format(): void
    {
        $this->expectException(InvalidArgumentException::class);
        StockCellParser::resolve('random 9000-8000');
    }

    public function test_parser_rejects_garbage(): void
    {
        $this->expectException(InvalidArgumentException::class);
        StockCellParser::resolve('random abc');
    }

    private function makeUpdateJob(): ImportJob
    {
        return ImportJob::create([
            'type' => 'stock_price_update',
            'source_file_name' => 'harga.xlsx',
            'source_file_path' => 'catalog/harga.xlsx',
            'total_rows' => 1,
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => User::factory()->create()->id,
        ]);
    }

    private function makeVariant(): ProductVariant
    {
        $product = Product::create([
            'name' => 'Tes Random Stok',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'product_category' => 'JENDELA',
            'short_name' => 'TRS',
            'status' => 'archived',
            'parent_sku' => 'RARNDPK1',
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RARNDPK1-V1',
            'price' => 1500000,
            'stock' => 5,
            'is_default' => true,
        ]);
    }

    public function test_update_import_applies_random_stock_range(): void
    {
        $job = $this->makeUpdateJob();
        $variant = $this->makeVariant();

        $export = new class implements FromCollection, WithHeadings
        {
            public function collection()
            {
                return collect([['parent_sku' => 'RARNDPK1', 'variant_sku' => 'RARNDPK1-V1', 'price' => '1500000', 'stock' => 'random 10-20']]);
            }

            public function headings(): array
            {
                return ['parent_sku', 'variant_sku', 'price', 'stock'];
            }
        };

        Excel::store($export, 'catalog/rnd.xlsx', 'imports');
        $path = Storage::disk('imports')->path('catalog/rnd.xlsx');
        Excel::import(new ImportStockPriceUpdate($job->id), $path);

        $stock = (int) $variant->fresh()->stock;
        $this->assertGreaterThanOrEqual(10, $stock);
        $this->assertLessThanOrEqual(20, $stock);
    }

    public function test_catalog_import_applies_random_stock_range(): void
    {
        config(['media.allowed_source_hosts' => ['example.com']]);
        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'katalog.xlsx',
            'source_file_path' => 'katalog.xlsx',
            'total_rows' => 1,
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => User::factory()->create()->id,
        ]);

        $export = new class implements FromCollection, WithHeadings
        {
            public function collection()
            {
                // Format v2: satu baris = satu varian, header Bahasa Indonesia.
                // Format stok acak ("random 30-40") tetap didukung.
                return collect([[
                    'no_id' => 1,
                    'nama_produk' => 'Jendela Random Stok',
                    'kategori_produk' => 'JENDELA',
                    'model_produk' => 'SWING_1_DAUN',
                    'sub_model' => 'POLOS',
                    'nama_variasi_1' => 'Warna',
                    'opsi_variasi_1' => 'Putih',
                    'harga' => '1000000',
                    'stok' => 'random 30-40',
                    'gambar_1_utama' => 'https://example.com/rnd.jpg',
                    'berat_kg' => '10',
                    'tinggi_cm' => '100',
                    'panjang_cm' => '50',
                    'lebar_cm' => '20',
                ]]);
            }

            public function headings(): array
            {
                return ['no_id', 'nama_produk', 'kategori_produk', 'model_produk', 'sub_model', 'nama_variasi_1', 'opsi_variasi_1', 'harga', 'stok', 'gambar_1_utama', 'berat_kg', 'tinggi_cm', 'panjang_cm', 'lebar_cm'];
            }
        };

        Excel::store($export, 'katalog.xlsx', 'imports');

        (new ProcessCatalogImport($job->id, 'katalog.xlsx'))->handle();

        $variant = ProductVariant::where('variation_1_option', 'Putih')->first();
        $this->assertNotNull($variant, 'Varian dari import katalog harus dibuat');
        $stock = (int) $variant->stock;
        $this->assertGreaterThanOrEqual(30, $stock);
        $this->assertLessThanOrEqual(40, $stock);
    }
}