<?php

namespace Tests\Feature;

use App\Imports\ImportStockPriceUpdate;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class StockPriceUpdateEmptyCellTest extends TestCase
{
    use RefreshDatabase;

    private function makeJob(): ImportJob
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
            'name' => 'Tes Stok Kosong',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'product_category' => 'JENDELA',
            'short_name' => 'TSK',
            'status' => 'archived',
            'parent_sku' => 'RATESTPK1',
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RATESTPK1-V1',
            'price' => 1500000,
            'stock' => 5,
            'is_default' => true,
        ]);
    }

    private function runImport(ImportJob $job, array $rows): void
    {
        $export = new class($rows) implements FromCollection, WithHeadings
        {
            public function __construct(public $rows) {}

            public function collection()
            {
                return collect($this->rows);
            }

            public function headings(): array
            {
                return ['parent_sku', 'variant_sku', 'price', 'stock'];
            }
        };

        $filename = 'stock_'.$job->id.'.xlsx';
        Excel::store($export, 'catalog/'.$filename, 'imports');
        $path = Storage::disk('imports')->path('catalog/'.$filename);
        Excel::import(new ImportStockPriceUpdate($job->id), $path);
    }

    public function test_empty_stock_cell_keeps_existing_stock_but_price_updates(): void
    {
        $job = $this->makeJob();
        $variant = $this->makeVariant();

        $this->runImport($job, [['parent_sku' => 'RATESTPK1', 'variant_sku' => 'RATESTPK1-V1', 'price' => '2000000', 'stock' => '']]);

        $this->assertSame(2000000, (int) $variant->fresh()->price);
        $this->assertSame(5, (int) $variant->fresh()->stock, 'Stok kosong harus mempertahankan nilai lama');
    }

    public function test_empty_price_cell_keeps_existing_price(): void
    {
        $job = $this->makeJob();
        $variant = $this->makeVariant();

        $this->runImport($job, [['parent_sku' => 'RATESTPK1', 'variant_sku' => 'RATESTPK1-V1', 'price' => '', 'stock' => '12']]);

        $this->assertSame(1500000, (int) $variant->fresh()->price, 'Harga kosong harus mempertahankan nilai lama');
        $this->assertSame(12, (int) $variant->fresh()->stock);
    }

    public function test_filled_cells_update_both(): void
    {
        $job = $this->makeJob();
        $variant = $this->makeVariant();

        $this->runImport($job, [['parent_sku' => 'RATESTPK1', 'variant_sku' => 'RATESTPK1-V1', 'price' => '1750000', 'stock' => '9']]);

        $this->assertSame(1750000, (int) $variant->fresh()->price);
        $this->assertSame(9, (int) $variant->fresh()->stock);
    }
}