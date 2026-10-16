<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\CmsModelProduct;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogImportVerifierV2;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Perbaikan 16 Okt 2026: kolom Model Produk yang kosong TIDAK LAGI lolos
 * pemeriksaan berkas lalu diam-diam menjadi SLIDING.
 *
 * Dulu baris dengan Model kosong diterima verifier, lalu importer menulis
 * product_model = SLIDING tanpa peringatan, sehingga produk tercatat salah
 * model tanpa admin sadar. Sekarang verifier menolaknya lebih dulu.
 */
class ImportBlankModelColumnTest extends TestCase
{
    use RefreshDatabase;

    private function baris(array $override = []): array
    {
        return array_merge([
            'no_id' => 1,
            'nama_produk' => 'Produk Uji Kolom Model',
            'deskripsi_produk' => 'Deskripsi.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'PINTU',
            'model_produk' => 'PINTU_LIPAT',
            'sub_model' => 'KISI_KISI',
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

    public function test_verifier_menolak_kolom_model_kosong(): void
    {
        $errors = CatalogImportVerifierV2::verify([$this->baris(['model_produk' => ''])]);

        $this->assertNotEmpty($errors, 'berkas dengan Model kosong harus ditolak');
        $pesan = implode(' | ', $errors);
        $this->assertStringContainsString('Model Produk wajib diisi', $pesan);
        $this->assertStringContainsString('baris pertama grup', $pesan);
    }

    public function test_verifier_menolak_kolom_model_hanya_spasi(): void
    {
        $errors = CatalogImportVerifierV2::verify([$this->baris(['model_produk' => '   '])]);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('Model Produk wajib diisi', implode(' | ', $errors));
    }

    public function test_verifier_menolak_kolom_kategori_kosong(): void
    {
        $errors = CatalogImportVerifierV2::verify([$this->baris(['kategori_produk' => ''])]);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('Kategori Produk wajib diisi', implode(' | ', $errors));
    }

    public function test_verifier_meloloskan_kolom_model_yang_terisi(): void
    {
        $errors = CatalogImportVerifierV2::verify([$this->baris()]);

        $this->assertSame([], $errors, 'berkas lengkap harus lolos');
    }

    public function test_importer_menolak_model_kosong_bukan_menulis_sliding(): void
    {
        \Illuminate\Support\Facades\Storage::fake('media');
        \Illuminate\Support\Facades\Storage::disk('media')->put('media-assets/utama/pdp.webp', 'isi-uji');

        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'uji.xlsx',
            'source_file_path' => 'tmp/uji.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => User::factory()->create(['role' => 'admin', 'status' => 'active'])->id,
        ]);

        $ss = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $ss->getActiveSheet();
        $ws->setTitle('Data');
        $rows = [$this->baris(['model_produk' => ''])];
        $headers = array_keys($rows[0]);
        foreach ($headers as $i => $header) {
            $ws->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1).'1', $header);
        }
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $ws->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c + 1).($r + 2), $value);
            }
        }
        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('tmp/uji-model-kosong.xlsx');
        @mkdir(dirname($path), 0775, true);
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($ss))->save($path);

        // Importer menolak berkas lewat verifier internal sebelum menulis apa pun.
        $ditolak = false;
        try {
            \Maatwebsite\Excel\Facades\Excel::import(new CatalogProductsImportV2($job->id, $path), $path);
        } catch (\Throwable $e) {
            $ditolak = true;
            $this->assertStringContainsString('Model Produk wajib diisi', $e->getMessage());
        }

        $this->assertTrue($ditolak, 'berkas dengan Model kosong harus ditolak');
        $this->assertSame(0, Product::count(), 'tidak ada produk yang boleh tercipta');
        $this->assertFalse(
            Product::where('product_model', 'SLIDING')->exists(),
            'produk tidak boleh tercatat sebagai SLIDING'
        );
    }
}
