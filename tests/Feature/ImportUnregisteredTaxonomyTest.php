<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\CmsModelProduct;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogImportVerifierV2;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * Perilaku ketiga kolom taksonomi ketika diisi nilai yang BELUM terdaftar
 * di database (pertanyaan owner 16 Okt 2026).
 *
 * Kesimpulan yang dijaga test ini:
 *  - Kategori Produk: WAJIB terdaftar. Nilai asing ditolak per baris.
 *  - Model Produk: nilai asing DITERIMA, wadah modelnya dibuat otomatis.
 *  - Sub Model: nilai asing DITERIMA apa adanya, tidak membuat baris sub model.
 */
class ImportUnregisteredTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    private function siapkanMedia(): void
    {
        \Illuminate\Support\Facades\Storage::fake('media');
        \Illuminate\Support\Facades\Storage::disk('media')->put('media-assets/utama/pdp.webp', 'isi-uji');
    }

    private function baris(array $override = []): array
    {
        return array_merge([
            'no_id' => 1,
            'nama_produk' => 'Produk Uji Taksonomi',
            'deskripsi_produk' => 'Deskripsi.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'PINTU',
            'model_produk' => 'MODEL_TERDAFTAR',
            'sub_model' => 'SUB_TERDAFTAR',
            'nama_variasi_1' => 'Warna',
            'opsi_variasi_1' => 'Putih',
            'harga' => 2000000,
            'stok' => 3,
            'berat_kg' => 20,
            'tinggi_cm' => 200,
            'panjang_cm' => 100,
            'lebar_cm' => 10,
            'gambar_1_utama' => 'https://media.333labs.tech/media-assets/utama/pdp.webp',
        ], $override);
    }

    private function berkas(array $rows): string
    {
        $ss = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $ss->getActiveSheet();
        $ws->setTitle('Data');
        $headers = array_keys($rows[0]);
        foreach ($headers as $i => $header) {
            $ws->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1).'1', $header);
        }
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $ws->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c + 1).($r + 2), $value);
            }
        }
        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('tmp/uji-taksonomi.xlsx');
        @mkdir(dirname($path), 0775, true);
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($ss))->save($path);

        return $path;
    }

    private function job(): ImportJob
    {
        return ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'uji.xlsx',
            'source_file_path' => 'tmp/uji.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => User::factory()->create(['role' => 'admin', 'status' => 'active'])->id,
        ]);
    }

    public function test_kategori_belum_terdaftar_ditolak_dan_hanya_barisnya_gagal(): void
    {
        $this->siapkanMedia();
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        $job = $this->job();
        $path = $this->berkas([$this->baris(['kategori_produk' => 'PAGAR_BELUM_ADA'])]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $this->assertSame(0, Product::count(), 'produk tidak boleh tercipta');
        $gagal = ImportJobRow::where('status', 'failed')->get();
        $this->assertCount(1, $gagal);
        $this->assertStringContainsString('tidak dikenal', (string) $gagal->first()->error_reason);
    }

    public function test_model_dan_sub_model_belum_terdaftar_diterima(): void
    {
        $this->siapkanMedia();
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        $job = $this->job();
        $path = $this->berkas([$this->baris([
            'model_produk' => 'MODEL_BELUM_TERDAFTAR',
            'sub_model' => 'SUB_BELUM_TERDAFTAR',
        ])]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::first();
        $this->assertNotNull($product, 'produk tetap tercipta');
        $this->assertSame('MODEL_BELUM_TERDAFTAR', $product->product_model);
        $this->assertSame('SUB_BELUM_TERDAFTAR', $product->design_variant);

        $errors = CatalogImportVerifierV2::verify([$this->baris(['model_produk' => 'MODEL_BELUM_TERDAFTAR'])]);
        $this->assertSame([], $errors, 'verifier meloloskan model yang belum terdaftar');

        app(\App\Services\ModelProductService::class)->syncFromCatalog(null);
        $this->assertDatabaseHas('cms_model_products', [
            'product_category' => 'PINTU',
            'product_model' => 'MODEL_BELUM_TERDAFTAR',
        ]);
    }

    public function test_sub_model_asing_tidak_membuat_baris_sub_model(): void
    {
        $this->siapkanMedia();
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        $job = $this->job();
        $path = $this->berkas([$this->baris([
            'model_produk' => 'MODEL_BELUM_TERDAFTAR',
            'sub_model' => 'SUB_BELUM_TERDAFTAR',
        ])]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $this->assertSame(
            0,
            SubModel::count(),
            'impor tidak membuat baris sub model; sub model baru didaftarkan lewat admin'
        );
    }
}
