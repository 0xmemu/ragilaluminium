<?php

namespace Tests\Feature;

use App\Exports\MediaUpdateTemplateExport;
use App\Imports\ImportMediaUpdate;
use App\Jobs\DownloadMediaAsset;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class ImportMediaUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function job(string $type = 'media_update'): ImportJob
    {
        $job = ImportJob::create([
            'type' => 'internal_bulk_update',
            'source_file_name' => 'x.xlsx',
            'source_file_path' => 'x.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => null,
        ]);
        if (\Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite') {
            \Illuminate\Support\Facades\DB::statement('PRAGMA ignore_check_constraints = ON');
        }
        $job->update(['type' => $type]);

        return $job;
    }

    protected function product(string $parentSku, string $variantSku): array
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
            'price' => 1000000,
            'stock' => 10,
            'status' => 'active',
        ]);

        return [$product, $variant];
    }

    protected function importRows(ImportJob $job, array $rows): string
    {
        $fname = 'med_test_'.uniqid().'.xlsx';
        Excel::store(new class($rows) implements \Maatwebsite\Excel\Concerns\FromArray {
            public function __construct(public array $rows) {}
            public function array(): array { return $this->rows; }
        }, $fname, 'local');
        Excel::import(new ImportMediaUpdate($job->id), $fname, 'local');

        return $fname;
    }

    public function test_media_update_tambah_foto_level_produk(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        [$product, $variant] = $this->product('RGL-M1', 'RGL-M1-A');
        $job = $this->job();

        $this->importRows($job, [
            ['parent_sku', 'variant_sku', 'image_1', 'image_2'],
            ['RGL-M1', '', 'https://example.com/prod-1.jpg', 'https://example.com/prod-2.jpg'],
        ]);

        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'product_variant_id' => null,
            'source_url' => 'https://example.com/prod-1.jpg',
            'is_main_image' => true,
            'show_in_catalog' => true,
        ]);
        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'product_variant_id' => null,
            'source_url' => 'https://example.com/prod-2.jpg',
            'is_main_image' => false,
        ]);
        $this->assertSame(1, ImportJobRow::where('import_job_id', $job->id)->where('status', 'success')->count());
    }

    public function test_media_update_image_1_di_baris_varian_tetap_level_produk(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        [$product, $variant] = $this->product('RGL-M2', 'RGL-M2-A');
        $job = $this->job();

        // Kolom image_1..9 selalu media level produk, apa pun baris yang
        // mengisinya (audit P1-3). Foto varian memakai kolom Gambar per Varian.
        $this->importRows($job, [
            ['parent_sku', 'variant_sku', 'image_1'],
            ['RGL-M2', 'RGL-M2-A', 'https://example.com/var-1.jpg'],
        ]);

        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'product_variant_id' => null,
            'source_url' => 'https://example.com/var-1.jpg',
            'is_main_image' => true,
        ]);
        $this->assertSame(
            0,
            ProductMedia::where('product_id', $product->id)->where('product_variant_id', $variant->id)->count(),
            'kolom image_1 tidak boleh menempel ke varian'
        );
    }

    public function test_media_update_foto_pemasangan_dan_slots(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        [$product, $variant] = $this->product('RGL-M3', 'RGL-M3-A');
        $job = $this->job();

        $this->importRows($job, [
            ['parent_sku', 'variant_sku', 'image_1', 'image_2', 'installation_image_1', 'installation_slots'],
            ['RGL-M3', 'RGL-M3-A', 'https://example.com/cat-1.jpg', 'https://example.com/cat-2.jpg', 'https://example.com/inst-x.jpg', '2'],
        ]);

        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'source_url' => 'https://example.com/cat-1.jpg',
            'is_installation' => false,
        ]);
        // slots "2" -> image_2 juga jadi foto pemasangan
        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'source_url' => 'https://example.com/cat-2.jpg',
            'is_installation' => true,
            'show_in_catalog' => true,
        ]);
        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'source_url' => 'https://example.com/inst-x.jpg',
            'is_installation' => true,
            'show_in_catalog' => false,
        ]);
    }

    public function test_media_update_sku_tidak_dikenal_gagal(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        $job = $this->job();

        $this->importRows($job, [
            ['parent_sku', 'variant_sku', 'image_1'],
            ['RGL-UNKNOWN', '', 'https://example.com/x.jpg'],
        ]);

        $this->assertSame(0, Product::where('parent_sku', 'RGL-UNKNOWN')->count(), 'tidak boleh membuat produk');
        $row = ImportJobRow::where('import_job_id', $job->id)->first();
        $this->assertSame('failed', $row->status);
        $this->assertStringContainsString('SKU tidak ditemukan', $row->error_reason);
    }

    public function test_media_update_variant_sku_asal_tidak_nyasar(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        [$prodA, $varA] = $this->product('RGL-A1', 'RGL-A1-A');
        [$prodB, $varB] = $this->product('RGL-B1', 'RGL-B1-A');
        $job = $this->job();

        // variant_sku milik produk lain, parent_sku diisi produk A: baris gagal
        $this->importRows($job, [
            ['parent_sku', 'variant_sku', 'image_1'],
            ['RGL-A1', 'RGL-B1-A', 'https://example.com/nyasar.jpg'],
        ]);

        $this->assertSame(0, ProductMedia::where('source_url', 'https://example.com/nyasar.jpg')->count(), 'foto tidak boleh nyasar');
        $row = ImportJobRow::where('import_job_id', $job->id)->first();
        $this->assertSame('failed', $row->status);
        $this->assertStringContainsString('tidak cocok', $row->error_reason);
    }

    public function test_media_update_sel_kosong_tidak_mengubah(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        [$product, $variant] = $this->product('RGL-M4', 'RGL-M4-A');
        ProductMedia::create([
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'source_url' => 'https://example.com/lama.jpg',
            'position' => 1,
            'status' => 'downloaded',
        ]);
        $job = $this->job();

        // Baris tanpa kolom gambar sama sekali: DILEWATI (kontrak owner 09-05),
        // media tidak berubah.
        $this->importRows($job, [
            ['parent_sku', 'variant_sku'],
            ['RGL-M4', 'RGL-M4-A'],
        ]);

        $this->assertSame(1, ProductMedia::where('product_id', $product->id)->count(), 'media lama tetap ada');
        $this->assertSame(1, ImportJobRow::where('import_job_id', $job->id)->where('status', 'skipped')->count());
    }

    public function test_template_media_update_v2(): void
    {
        $raw = Excel::raw(new MediaUpdateTemplateExport(), \Maatwebsite\Excel\Excel::XLSX);
        $path = tempnam(sys_get_temp_dir(), "tpl_m").".xlsx";
        file_put_contents($path, $raw);
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);

        // Kontrak v2 (2026-09-18): dua sheet tanpa Contoh, header Bahasa
        // Indonesia, empat kolom identitas dikunci, kolom media dikosongkan.
        $this->assertSame(["Update Media", "Panduan"], $ss->getSheetNames());

        $ws = $ss->getSheet(0);
        $this->assertSame("SKU Produk", (string) $ws->getCell("A1")->getValue());
        $this->assertSame("Nama Produk", (string) $ws->getCell("B1")->getValue());
        $this->assertSame("SKU Varian", (string) $ws->getCell("C1")->getValue());
        $this->assertSame("Variasi", (string) $ws->getCell("D1")->getValue());
        $this->assertSame("Gambar per Varian", (string) $ws->getCell("E1")->getValue());
        $this->assertSame("Gambar 1 (utama)", (string) $ws->getCell("F1")->getValue());

        // Empat kolom identitas wajib terkunci pada baris data. Template
        // kosong tetap punya baris 2 supaya rentang kunci punya tempat, jadi
        // baris 2 dipakai sebagai acuan (bukan baris 1 yang isinya header).
        $ws->setCellValue("A2", "CONTOH-SKU");
        $raw2 = Excel::raw(new MediaUpdateTemplateExport(), \Maatwebsite\Excel\Excel::XLSX);
        $path2 = tempnam(sys_get_temp_dir(), "tpl_m2").".xlsx";
        file_put_contents($path2, $raw2);
        $ss2 = \PhpOffice\PhpSpreadsheet\IOFactory::load($path2);
        $ws2 = $ss2->getSheet(0);
        foreach (["A", "B", "C", "D"] as $kolom) {
            $this->assertSame(
                "protected",
                $ws2->getCell($kolom . "2")->getStyle()->getProtection()->getLocked(),
                "kolom identitas " . $kolom . " wajib terkunci"
            );
        }
    }
}
