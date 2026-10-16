<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\CmsModelProduct;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * Membuktikan perilaku kolom Model dan Sub Model pada XLSX saat tabel
 * taksonomi kosong dan kolomnya dibiarkan KOSONG oleh admin.
 */
class ImportBlankModelColumnTest extends TestCase
{
    use RefreshDatabase;

    private function siapkanMedia(): void
    {
        \Illuminate\Support\Facades\Storage::fake('media');
        \Illuminate\Support\Facades\Storage::disk('media')->put('media-assets/utama/pdp.webp', 'isi-uji');
    }

    private function berkas(array $rows): string
    {
        $ss = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $ss->getActiveSheet();
        $ws->setTitle('Data');

        $headers = array_keys($rows[0]);
        foreach ($headers as $i => $header) {
            $ws->setCellValue(
                \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1).'1',
                $header
            );
        }
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $ws->setCellValue(
                    \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c + 1).($r + 2),
                    $value
                );
            }
        }

        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('tmp/uji-kosong-model.xlsx');
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

    private function barisKosongTaksonomi(): array
    {
        return [
            'no_id' => 1,
            'nama_produk' => 'Produk Tanpa Kolom Model',
            'deskripsi_produk' => 'Deskripsi.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'PINTU',
            'model_produk' => '',
            'sub_model' => '',
            'nama_variasi_1' => 'Warna',
            'opsi_variasi_1' => 'Putih',
            'harga' => 2000000,
            'stok' => 3,
            'berat_kg' => 20,
            'tinggi_cm' => 200,
            'panjang_cm' => 100,
            'lebar_cm' => 10,
            'gambar_1_utama' => 'https://media.333labs.tech/media-assets/utama/pdp.webp',
        ];
    }

    public function test_kolom_model_kosong_jatuh_ke_sliding_diam_diam(): void
    {
        $this->siapkanMedia();
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        $job = $this->job();
        $path = $this->berkas([$this->barisKosongTaksonomi()]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::first();
        $this->assertNotNull($product, 'produk tetap tercipta');

        // PERILAKU LAMA YANG TERDOKUMENTASI: kolom Model kosong TIDAK ditolak,
        // melainkan diam-diam menjadi SLIDING oleh CatalogProductsImportV2
        // ($data['model_produk'] ?? '' dinormalkan lalu jatuh ke 'SLIDING').
        // Ini bukan efek perubahan taksonomi dinamis, melainkan perilaku bawaan
        // importer. Test ini mengunci perilaku itu supaya perubahan mendatang
        // terlihat, bukan menyatakan bahwa perilaku ini diinginkan.
        $this->assertSame('SLIDING', $product->product_model, 'kolom Model kosong jatuh ke SLIDING');
        $this->assertNull($product->design_variant, 'kolom Sub Model kosong tetap null');

        app(\App\Services\ModelProductService::class)->syncFromCatalog(null);
        $this->assertTrue(
            CmsModelProduct::where('product_model', 'SLIDING')->exists(),
            'wadah SLIDING lahir dari nilai fallback'
        );
    }
}
