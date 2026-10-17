<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\CmsModelProduct;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogLabels;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * Regresi 17 Okt 2026: setelah import, halaman Edit Produk menampilkan Model
 * "Pilih..." karena daftar model hanya dibaca dari wadah yang aktif.
 */
class ProductModelDropdownTest extends TestCase
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

    private function berkas(): string
    {
        $row = [
            'no_id' => 1,
            'nama_produk' => 'Pintu Aluminium Lipat Empat Daun',
            'deskripsi_produk' => 'Deskripsi produk uji.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'PINTU',
            'model_produk' => 'PINTU_LIPAT',
            'sub_model' => 'ORNAMEN',
            'nama_variasi_1' => 'Warna',
            'opsi_variasi_1' => 'Putih',
            'harga' => 2500000,
            'stok' => 5,
            'berat_kg' => 30,
            'tinggi_cm' => 240,
            'panjang_cm' => 200,
            'lebar_cm' => 10,
            'gambar_1_utama' => 'https://media.333labs.tech/media-assets/utama/pdp.webp',
        ];

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

        $path = Storage::disk('imports')->path('tmp/uji-model-dropdown.xlsx');
        @mkdir(dirname($path), 0775, true);
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save($path);

        return $path;
    }

    public function test_model_hasil_import_tetap_terpilih_walau_wadah_nonaktif(): void
    {
        $this->siapkan();

        // Keadaan nyata di produksi: wadah model sudah dibuat admin tetapi
        // masih Nonaktif (draft), dan belum ada satu pun sub model.
        CmsModelProduct::create([
            'name' => 'Pintu Lipat',
            'product_category' => 'PINTU',
            'product_model' => 'PINTU_LIPAT',
            'status' => 'draft',
            'sort_order' => 1,
        ]);

        // Panaskan cache dalam keadaan kosong, meniru halaman admin yang sudah
        // dibuka sebelum import berjalan.
        $this->assertSame([], CatalogLabels::modelCodes());

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'uji.xlsx',
            'source_file_path' => 'tmp/uji.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => $admin->id,
        ]);

        $path = $this->berkas();
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::firstOrFail();
        $this->assertSame('PINTU_LIPAT', $product->product_model);

        $this->assertContains(
            'PINTU_LIPAT',
            CatalogLabels::modelCodes(),
            'model yang dipakai produk harus ada di daftar'
        );

        $options = collect(CatalogLabels::modelOptions());
        $this->assertContains(
            'PINTU_LIPAT',
            $options->pluck('value')->all(),
            'dropdown form admin harus memuat model produk'
        );
        // Label dropdown diberi awalan kategori oleh CatalogLabels::modelOptions().
        $this->assertSame('Pintu · Pintu Lipat', $options->firstWhere('value', 'PINTU_LIPAT')['label']);

        $validator = Validator::make(
            ['product_model' => 'PINTU_LIPAT'],
            ['product_model' => ['required', Rule::in(CatalogLabels::modelCodes())]],
        );
        $this->assertFalse(
            $validator->fails(),
            'menyimpan produk dengan model yang sudah tersimpan tidak boleh ditolak'
        );
    }

    public function test_mengaktifkan_wadah_model_langsung_terbaca(): void
    {
        $this->siapkan();

        $row = CmsModelProduct::create([
            'name' => 'Sliding',
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'draft',
            'sort_order' => 1,
        ]);

        $this->assertNotContains('SLIDING', CatalogLabels::modelCodes());

        $row->update(['status' => 'active']);

        $this->assertContains(
            'SLIDING',
            CatalogLabels::modelCodes(),
            'cache daftar model harus ikut dibuang saat wadah diaktifkan'
        );
    }
}
