<?php

namespace Tests\Feature;

use App\Exports\CatalogTemplateExport;
use App\Exports\StockPriceTemplateExport;
use App\Imports\ImportStockPriceUpdate;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Sheet;
use Tests\TestCase;

class ImportCatalogIndonesiaTest extends TestCase
{
    use RefreshDatabase;

    protected function job(string $type, string $stockMode = 'file'): ImportJob
    {
        $job = ImportJob::create([
            'type' => 'internal_bulk_update',
            'source_file_name' => 'x.xlsx',
            'source_file_path' => 'x.xlsx',
            'stock_mode' => $stockMode,
            'status' => 'pending',
            'triggered_by_user_id' => null,
        ]);
        if (\Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite') {
            \Illuminate\Support\Facades\DB::statement('PRAGMA ignore_check_constraints = ON');
        }
        $job->update(['type' => $type]);

        return $job;
    }

    protected function product(string $parentSku, string $variantSku, float $price = 1000000, int $stock = 10): array
    {
        $product = Product::create([
            'parent_sku' => $parentSku,
            'name' => 'Produk '.$parentSku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $variantSku,
            'price' => $price,
            'stock' => $stock,
            'status' => 'active',
        ]);

        return [$product, $variant];
    }

    public function test_stock_price_update_ubah_harga_dan_stok(): void
    {
        [$product, $variant] = $this->product('RGL-T1', 'RGL-T1-A');
        $job = $this->job('stock_price_update');

        $rows = [
            ['parent_sku', 'variant_sku', 'price', 'stock'],
            ['RGL-T1', 'RGL-T1-A', '1500000', '7'],
        ];

        $fname = 'spu_test_'.uniqid().'.xlsx';
        Excel::store(new class($rows) implements \Maatwebsite\Excel\Concerns\FromArray {
            public function __construct(public array $rows) {}
            public function array(): array { return $this->rows; }
        }, $fname, 'local');
        Excel::import(new ImportStockPriceUpdate($job->id), $fname, 'local');

        $variant->refresh();
        $this->assertSame(1500000.0, (float) $variant->price);
        $this->assertSame(7, (int) $variant->stock);
        $this->assertSame('JENDELA', $product->fresh()->product_category, 'kolom lain tidak boleh berubah');
        $this->assertSame(1, ImportJobRow::where('import_job_id', $job->id)->where('status', 'success')->count());
    }

    public function test_stock_price_update_sku_tidak_dikenal_gagal(): void
    {
        $job = $this->job('stock_price_update');
        $fname2 = 'spu_unknown_'.uniqid().'.xlsx';
        Excel::store(new class implements \Maatwebsite\Excel\Concerns\FromArray {
            public function array(): array
            {
                return [
                    ['parent_sku', 'variant_sku', 'price', 'stock'],
                    ['RGL-UNKNOWN', '', '1', '1'],
                ];
            }
        }, $fname2, 'local');
        Excel::import(new ImportStockPriceUpdate($job->id), $fname2, 'local');

        $this->assertSame(0, Product::where('parent_sku', 'RGL-UNKNOWN')->count(), 'tidak boleh membuat produk');
        $row = ImportJobRow::where('import_job_id', $job->id)->first();
        $this->assertSame('failed', $row->status);
        $this->assertStringContainsString('SKU tidak ditemukan', $row->error_reason);
    }

    public function test_template_katalog_xlsx_memiliki_tiga_sheet(): void
    {
        $raw = Excel::raw(new CatalogTemplateExport(), \Maatwebsite\Excel\Excel::XLSX);
        $path = tempnam(sys_get_temp_dir(), 'tpl_c').'.xlsx';
        file_put_contents($path, $raw);
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
        $names = [];
        foreach ($ss->getSheetNames() as $name) {
            $names[] = $name;
        }
        $this->assertCount(3, $names);
        $first = $ss->getSheet(0)->toArray()[0];
        $this->assertContains('name', $first);
        // Format owner 09-05: harga per kombinasi varian.
        $this->assertContains('price_variantion_combination', $first);
        $this->assertContains('variantion_combination', $first);
    }

    public function test_template_stock_price_xlsx(): void
    {
        $raw2 = Excel::raw(new StockPriceTemplateExport(), \Maatwebsite\Excel\Excel::XLSX);
        $path2 = tempnam(sys_get_temp_dir(), 'tpl_s').'.xlsx';
        file_put_contents($path2, $raw2);
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load($path2);
        $this->assertCount(2, $ss->getSheetNames());
        $this->assertSame(['Data', 'Panduan'], $ss->getSheetNames());
        $first = $ss->getSheet(0)->toArray()[0];
        $this->assertSame(['parent_sku', 'variant_sku', 'variant_combination', 'price', 'stock'], $first);
    }
}