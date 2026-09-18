<?php

namespace Tests\Feature;

use App\Jobs\DownloadMediaAsset;
use App\Jobs\ProcessCatalogImport;
use App\Models\ImportJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class ImportPipelineTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_creates_products_variants_and_media(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        $rows = collect([
            ['parent_sku' => 'WIN-IMP-1', 'name' => 'Window', 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'variant_sku' => 'WIN-IMP-1-V1', 'price' => 1000000, 'stock' => 5, 'image_1' => 'https://example.com/a.jpg', 'weight_kg' => 10, 'height_cm' => 100, 'width_cm' => 50, 'depth_cm' => 20],
        ]);
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
        Excel::store($export, 'imp.xlsx', 'imports');
        $path = Storage::disk('imports')->path('imp.xlsx');

        $job = ImportJob::create(['type' => 'shopee_mass_upload', 'source_file_name' => 'imp.xlsx', 'source_file_path' => 'imp.xlsx', 'status' => 'pending']);

        (new ProcessCatalogImport($job->id, 'imp.xlsx'))->handle();

        $job->refresh();
        $this->assertEquals('completed', $job->status);
        $this->assertEquals(1, $job->success_rows);
        $this->assertDatabaseHas('products', ['parent_sku' => 'WIN-IMP-1', 'status' => 'archived']);
        // Pasangan model dibuat otomatis oleh sinkronisasi pasca-import.
        // Status mengikuti aturan wadah: produk hasil import ini archived
        // (gate kelengkapan), jadi wadahnya langsung diarsip otomatis.
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'status' => 'draft',
        ]);
        $this->assertDatabaseHas('product_variants', ['variant_sku' => 'WIN-IMP-1-V1']);
        $this->assertDatabaseHas('product_media', ['source_url' => 'https://example.com/a.jpg']);
        Queue::assertPushed(DownloadMediaAsset::class);
        $row = ImportJob::whereKey($job->id)->first()->rows()->first();
        $this->assertSame('archived', $row->raw_data['_activation_status']);
        $this->assertNotEmpty($row->raw_data['_activation_reasons']);
    }

    public function test_import_manual_stock_used_when_file_stock_empty(): void
    {
        $rows = collect([
            ['parent_sku' => 'WIN-STOCK-1', 'name' => 'Window stock', 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'design_variant' => 'POLOS', 'variant_sku' => 'WIN-STOCK-1-V1', 'price' => 1000000, 'stock' => '', 'image_1' => 'https://example.com/b.jpg', 'weight_kg' => 10, 'height_cm' => 100, 'width_cm' => 50, 'depth_cm' => 20],
        ]);
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

    /**
     * Kontrak pemisah spesifikasi (2026-09-18): koma memulai spesifikasi baru
     * BILA potongannya memuat "Nama: Nilai"; koma di dalam nilai (mis. daftar
     * pilihan "hitam, putih, cokelat") tetap bagian dari nilai yang sama.
     */
    public function test_spesifikasi_dipisah_koma_dan_koma_dalam_nilai_tetap_utuh(): void
    {
        $rows = collect([
            [
                'parent_sku' => 'WIN-SPEC-1',
                'name' => 'Window spec',
                'product_category' => 'WINDOW',
                'product_model' => 'JUNGKIT',
                'design_variant' => 'POLOS',
                'variant_sku' => 'WIN-SPEC-1-V1',
                'price' => 1000000,
                'stock' => 5,
                'weight_kg' => 10,
                'height_cm' => 100,
                'width_cm' => 50,
                'depth_cm' => 20,
                'image_1' => 'https://example.com/spec-1.jpg',
                // Koma memisah 3 spesifikasi; koma di dalam nilai tetap utuh.
                'specifications' => 'Bahan: Aluminium, Kaca: Tempered, Finishing: Powder coating interpon (pilihan: hitam, putih, cokelat, serat kayu)',
            ],
        ]);
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
        Excel::store($export, 'spec.xlsx', 'imports');

        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => 'spec.xlsx',
            'source_file_path' => 'spec.xlsx',
            'status' => 'pending',
        ]);

        (new ProcessCatalogImport($job->id, 'spec.xlsx'))->handle();

        $product = \App\Models\Product::where('parent_sku', 'WIN-SPEC-1')->firstOrFail();
        $attributes = \App\Models\ProductAttribute::where('product_id', $product->id)
            ->whereNull('product_variant_id')
            ->pluck('attribute_value', 'attribute_name')
            ->all();

        $this->assertSame('Aluminium', $attributes['Bahan'] ?? null);
        $this->assertSame('Tempered', $attributes['Kaca'] ?? null);
        $this->assertSame(
            'Powder coating interpon (pilihan: hitam, putih, cokelat, serat kayu)',
            $attributes['Finishing'] ?? null,
            'Koma di dalam nilai tidak boleh memecah spesifikasi menjadi baris baru.'
        );
        $this->assertCount(3, $attributes);
    }

    /** Pemisah titik koma dan baris baru tetap didukung (kompatibilitas file lama). */
    public function test_spesifikasi_titik_koma_dan_baris_baru_tetap_didukung(): void
    {
        $rows = collect([
            [
                'parent_sku' => 'WIN-SPEC-2',
                'name' => 'Window spec lama',
                'product_category' => 'WINDOW',
                'product_model' => 'JUNGKIT',
                'design_variant' => 'POLOS',
                'variant_sku' => 'WIN-SPEC-2-V1',
                'price' => 900000,
                'stock' => 4,
                'weight_kg' => 9,
                'height_cm' => 90,
                'width_cm' => 45,
                'depth_cm' => 18,
                'image_1' => 'https://example.com/spec-2.jpg',
                'specifications' => "Bahan: Aluminium; Kusen: 3 inch\nGaransi: 1 tahun",
            ],
        ]);
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
        Excel::store($export, 'spec-old.xlsx', 'imports');

        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => 'spec-old.xlsx',
            'source_file_path' => 'spec-old.xlsx',
            'status' => 'pending',
        ]);

        (new ProcessCatalogImport($job->id, 'spec-old.xlsx'))->handle();

        $product = \App\Models\Product::where('parent_sku', 'WIN-SPEC-2')->firstOrFail();
        $attributes = \App\Models\ProductAttribute::where('product_id', $product->id)
            ->whereNull('product_variant_id')
            ->pluck('attribute_value', 'attribute_name')
            ->all();

        $this->assertSame('Aluminium', $attributes['Bahan'] ?? null);
        $this->assertSame('3 inch', $attributes['Kusen'] ?? null);
        $this->assertSame('1 tahun', $attributes['Garansi'] ?? null);
    }
}
