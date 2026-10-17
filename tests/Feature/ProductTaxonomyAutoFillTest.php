<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\CmsModelProduct;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogLabels;
use App\Support\ProductTaxonomyRegistrar;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * Kontrak 17 Okt 2026 (permintaan owner):
 *  - Sub Model terisi OTOMATIS dari kolom XLSX, tanpa admin mengetik ulang.
 *  - Sub Model boleh kosong bila model produk memang tidak punya sub model.
 *  - Nama wadah model produk disusun dari kategori + model saja, tanpa
 *    menyisipkan "Aluminium" yang mengasumsikan bahan produk.
 */
class ProductTaxonomyAutoFillTest extends TestCase
{
    use RefreshDatabase;

    private function siapkan(): void
    {
        Storage::fake('media');
        Storage::disk('media')->put('media-assets/utama/pdp.webp', 'isi-uji');

        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        Cache::flush();
    }

    private function berkas(array $override = []): string
    {
        $row = array_merge([
            'no_id' => 1,
            'nama_produk' => 'Jendela Aluminium Jungkit Ornamen 100 x 70 cm',
            'deskripsi_produk' => 'Deskripsi produk uji.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'JENDELA',
            'model_produk' => 'JUNGKIT',
            'sub_model' => 'ORNAMEN',
            'nama_variasi_1' => 'Warna',
            'opsi_variasi_1' => 'Putih',
            'harga' => 1500000,
            'stok' => 4,
            'berat_kg' => 18,
            'tinggi_cm' => 100,
            'panjang_cm' => 70,
            'lebar_cm' => 8,
            'gambar_1_utama' => 'https://media.333labs.tech/media-assets/utama/pdp.webp',
        ], $override);

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        foreach (array_keys($row) as $index => $header) {
            $sheet->setCellValue(
                \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($index + 1).'1',
                $header
            );
        }
        foreach (array_values($row) as $index => $value) {
            $sheet->setCellValue(
                \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($index + 1).'2',
                $value
            );
        }

        $path = Storage::disk('imports')->path('tmp/uji-auto-taksonomi.xlsx');
        @mkdir(dirname($path), 0775, true);
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save($path);

        return $path;
    }

    private function jalankanImpor(array $override = []): Product
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'uji.xlsx',
            'source_file_path' => 'tmp/uji.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => $admin->id,
        ]);

        $path = $this->berkas($override);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        return Product::firstOrFail();
    }

    public function test_sub_model_dari_xlsx_terdaftar_otomatis(): void
    {
        $this->siapkan();
        $this->assertSame(0, SubModel::count(), 'prasyarat: daftar sub model kosong');

        $product = $this->jalankanImpor();

        $this->assertSame('ORNAMEN', $product->design_variant);

        $row = SubModel::query()
            ->where('product_model', 'JUNGKIT')
            ->where('code', 'ORNAMEN')
            ->first();

        $this->assertNotNull($row, 'sub model dari XLSX harus muncul di Kelola Sub Model');
        $this->assertSame('Ornamen', $row->name, 'nama memakai label yang sama dengan dropdown admin');
        $this->assertTrue($row->is_active, 'sub model baru langsung aktif');
    }

    public function test_sub_model_boleh_kosong_tanpa_membuat_baris(): void
    {
        $this->siapkan();

        $product = $this->jalankanImpor(['sub_model' => '']);

        $this->assertNull($product->design_variant, 'model tanpa sub model sah');
        $this->assertSame(
            0,
            SubModel::count(),
            'sub model kosong tidak boleh membuat baris palsu'
        );
    }

    public function test_pendaftaran_sub_model_idempoten(): void
    {
        $this->siapkan();

        ProductTaxonomyRegistrar::registerSubModel('JUNGKIT', 'ORNAMEN');
        ProductTaxonomyRegistrar::registerSubModel('JUNGKIT', 'ORNAMEN');
        // Bentuk huruf kecil dinormalisasi ke kode yang sama, jadi tetap satu baris.
        ProductTaxonomyRegistrar::registerSubModel('JUNGKIT', 'ornamen');

        $this->assertSame(
            1,
            SubModel::where('product_model', 'JUNGKIT')->count(),
            'pasangan model + sub model yang sama tidak boleh diduplikasi'
        );
    }

    public function test_nama_wadah_model_tanpa_kata_aluminium(): void
    {
        $this->siapkan();

        $this->assertSame('Jendela Jungkit', CatalogLabels::modelCardTitle('JENDELA', 'JUNGKIT'));
        $this->assertSame('Pintu Sliding Dua Daun', CatalogLabels::modelCardTitle('PINTU', 'SLIDING_2_DAUN'));
        $this->assertSame('Boven Kaca Mati', CatalogLabels::modelCardTitle('BOVEN', 'KACA_MATI'));

        // Model yang labelnya sudah memuat nama kategori tidak diulang.
        CmsModelProduct::create([
            'name' => 'Pintu Lipat',
            'product_category' => 'PINTU',
            'product_model' => 'PINTU_LIPAT',
            'status' => 'active',
        ]);
        Cache::flush();

        $this->assertSame('Pintu Lipat', CatalogLabels::modelCardTitle('PINTU', 'PINTU_LIPAT'));
    }

    public function test_label_model_lama_dengan_aluminium_tetap_terbaca_benar(): void
    {
        $this->siapkan();

        // Baris lama hasil penyelarasan sebelum perubahan ini.
        CmsModelProduct::create([
            'name' => 'Jendela Aluminium Jungkit',
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'status' => 'active',
        ]);
        Cache::flush();

        $this->assertSame('Jungkit', CatalogLabels::model('JUNGKIT'));
        $this->assertSame('Jendela Jungkit', CatalogLabels::modelCardTitle('JENDELA', 'JUNGKIT'));
    }
}
