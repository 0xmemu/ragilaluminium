<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\CmsModelProduct;
use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SubModel;
use App\Models\User;
use App\Support\CatalogLabels;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class ImportWithoutTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    private function siapkanMedia(): void
    {
        \Illuminate\Support\Facades\Storage::fake('media');
        \Illuminate\Support\Facades\Storage::disk('media')->put('media-assets/utama/pdp.webp', 'isi-uji');
    }

    private function urlMedia(string $path): string
    {
        return 'https://media.333labs.tech/'.$path;
    }

    private function baris(array $override = []): array
    {
        return array_merge([
            'no_id' => 1,
            'nama_produk' => 'Partisi Geser Lipat Empat Daun',
            'deskripsi_produk' => 'Deskripsi produk uji.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'PINTU',
            'model_produk' => 'PINTU_LIPAT',
            'sub_model' => 'KISI_KISI',
            'nama_variasi_1' => 'Warna',
            'opsi_variasi_1' => 'Putih',
            'harga' => 2500000,
            'stok' => 5,
            'berat_kg' => 30,
            'tinggi_cm' => 240,
            'panjang_cm' => 200,
            'lebar_cm' => 10,
            'gambar_1_utama' => $this->urlMedia('media-assets/utama/pdp.webp'),
        ], $override);
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

        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('tmp/uji-kosong.xlsx');
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

    private function kosongkanTaksonomi(): void
    {
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();
    }

    public function test_impor_berhasil_walau_model_dan_sub_model_kosong_total(): void
    {
        $this->siapkanMedia();
        $this->kosongkanTaksonomi();

        $this->assertSame(0, CmsModelProduct::count(), 'prasyarat: cms_model_products kosong');
        $this->assertSame(0, SubModel::count(), 'prasyarat: sub_models kosong');

        $job = $this->job();
        $path = $this->berkas([$this->baris()]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $this->assertSame(1, Product::count(), 'produk baru harus tercipta walau taksonomi kosong');
        $this->assertSame(1, ProductVariant::count(), 'varian baru harus tercipta');

        $product = Product::first();
        $this->assertSame('PINTU', $product->product_category);
        $this->assertSame('PINTU_LIPAT', $product->product_model);
        $this->assertSame('KISI_KISI', $product->design_variant);
    }

    public function test_kategori_tak_dikenal_jadi_baris_gagal_bukan_crash(): void
    {
        $this->siapkanMedia();
        $this->kosongkanTaksonomi();

        $job = $this->job();
        $path = $this->berkas([$this->baris(['kategori_produk' => 'KATEGORI_NGAWUR'])]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $this->assertSame(0, Product::count(), 'produk tidak boleh tercipta');
        $gagal = ImportJobRow::where('status', 'failed')->get();
        $this->assertCount(1, $gagal, 'baris dicatat gagal, bukan melempar exception');
    }

    public function test_dropdown_template_saat_taksonomi_kosong(): void
    {
        $this->kosongkanTaksonomi();

        // Sumber dropdown yang dipakai sheet template: kategori dari tabel
        // categories, model dari CatalogLabels::modelCodes(), sub model dari
        // tabel sub_models yang aktif.
        $kategori = CatalogLabels::categoryCodes();
        $model = CatalogLabels::modelCodes();
        $sub = SubModel::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')
            ->pluck('code')->unique()->values()->all();

        $this->assertContains('PINTU', $kategori);
        $this->assertSame([], $sub, 'sub model kosong karena tabelnya kosong');
    }

    public function test_model_di_luar_daftar_diterima_impor(): void
    {
        $this->siapkanMedia();
        $this->kosongkanTaksonomi();

        $job = $this->job();
        $path = $this->berkas([$this->baris([
            'model_produk' => 'PINTU_PIVOT_MODEL_BARU',
            'sub_model' => 'DESAIN_BARU_SEKALI',
        ])]);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::first();
        $this->assertNotNull($product, 'model baru di luar daftar tetap diterima');
        $this->assertSame('PINTU_PIVOT_MODEL_BARU', $product->product_model);
        $this->assertSame('DESAIN_BARU_SEKALI', $product->design_variant);
    }
}
