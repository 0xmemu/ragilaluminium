<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImport;
use App\Jobs\ProcessCatalogImport;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductMedia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Storage;

class ImportPipelineTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_import_creates_products_variants_and_media(): void
    {
        $rows = collect([
            ['parent_sku' => 'WIN-IMP-1', 'name' => 'Window', 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'variant_sku' => 'WIN-IMP-1-V1', 'price' => 1000000, 'stock' => 5, 'image_1' => 'https://example.com/a.jpg'],
        ]);
        $export = new class($rows) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            public function __construct(public $rows) {}
            public function collection() { return $this->rows; }
            public function headings(): array { return array_keys($this->rows->first()); }
        };
        Excel::store($export, 'imp.xlsx', 'imports');
        $path = Storage::disk('imports')->path('imp.xlsx');

        $job = ImportJob::create(['type' => 'shopee_mass_upload', 'source_file_name' => 'imp.xlsx', 'source_file_path' => 'imp.xlsx', 'status' => 'pending']);

        (new ProcessCatalogImport($job->id, 'imp.xlsx'))->handle();

        $job->refresh();
        $this->assertEquals('completed', $job->status);
        $this->assertEquals(1, $job->success_rows);
        $this->assertDatabaseHas('products', ['parent_sku' => 'WIN-IMP-1', 'status' => 'active']);
        $this->assertDatabaseHas('product_variants', ['variant_sku' => 'WIN-IMP-1-V1']);
        $this->assertDatabaseHas('product_media', ['source_url' => 'https://example.com/a.jpg']);
    }

    public function test_import_manual_stock_overrides_file_stock(): void
    {
        $rows = collect([
            ['parent_sku' => 'WIN-STOCK-1', 'name' => 'Window stock', 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'variant_sku' => 'WIN-STOCK-1-V1', 'price' => 1000000, 'stock' => 7],
        ]);
        $export = new class($rows) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            public function __construct(public $rows) {}
            public function collection() { return $this->rows; }
            public function headings(): array { return array_keys($this->rows->first()); }
        };
        Excel::store($export, 'manual-stock.xlsx', 'imports');

        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => 'manual-stock.xlsx',
            'source_file_path' => 'manual-stock.xlsx',
            'stock_mode' => 'manual',
            'manual_stock' => 5000,
            'status' => 'pending',
        ]);

        (new ProcessCatalogImport($job->id, 'manual-stock.xlsx'))->handle();

        $this->assertDatabaseHas('product_variants', [
            'variant_sku' => 'WIN-STOCK-1-V1',
            'stock' => 5000,
        ]);
        $this->assertSame('manual', $job->fresh()->stock_mode);
        $this->assertSame(5000, $job->fresh()->manual_stock);
    }
}
