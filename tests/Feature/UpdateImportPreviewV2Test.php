<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\UpdateImportColumnMap;
use App\Support\UpdateImportVerifier;
use App\Support\UpdatePreviewDiff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * Regresi temuan 14 Okt 2026: lapisan "Periksa file" untuk update harga/stok
 * dan update media memakai kunci internal, sedangkan template v2 memakai
 * header Bahasa Indonesia. Tanpa normalisasi, verifier dan diff tidak melihat
 * baris apa pun, dan endpoint pratinjau bahkan 500 karena variabel manualStock
 * tidak terdefinisi.
 */
class UpdateImportPreviewV2Test extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create([
            'name' => 'Admin Uji',
            'username' => 'adminuji',
            'password' => bcrypt('rahasia'),
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function variantUji(): ProductVariant
    {
        $product = Product::create([
            'parent_sku' => 'RAUJI001',
            'name' => 'Produk Uji Update',
            'short_name' => 'Produk Uji',
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT_1_DAUN',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RAUJIVAR1',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'price' => 1000000,
            'stock' => 10,
            'status' => 'active',
        ]);
    }

    public function test_verifier_v2_mendeteksi_galat_setelah_normalisasi(): void
    {
        // Baris bentuk template v2 apa adanya (belum dinormalisasi): verifier
        // lama tidak melihat apa pun.
        $raw = [['sku_produk' => 'RAUJI001', 'sku_varian' => 'RAUJIVAR1', 'harga' => '', 'stok' => '']];
        $hasilMentah = UpdateImportVerifier::verify($raw, 'stock_price_update', null);
        $this->assertSame([], $hasilMentah['errors'], 'baris mentah v2 memang belum terbaca');

        // Setelah dinormalisasi: harga dan stok kosong bersamaan harus ditolak.
        $normal = array_map(fn ($r) => UpdateImportColumnMap::normalize($r), $raw);
        $hasil = UpdateImportVerifier::verify($normal, 'stock_price_update', null);
        $this->assertNotEmpty($hasil['errors'], 'harga+stok kosong harus terdeteksi');

        // SKU varian tak dikenal juga harus terdeteksi setelah normalisasi.
        $unknown = array_map(fn ($r) => UpdateImportColumnMap::normalize($r), [
            ['sku_produk' => 'RAUJI001', 'sku_varian' => 'RATIDAKADA', 'harga' => '1500000', 'stok' => '5'],
        ]);
        $hasilUnknown = UpdateImportVerifier::verify($unknown, 'stock_price_update', null);
        $this->assertNotEmpty($hasilUnknown['errors'], 'SKU tak dikenal harus terdeteksi');
    }

    public function test_diff_v2_melaporkan_perubahan_harga(): void
    {
        $this->variantUji();

        $rows = array_map(fn ($r) => UpdateImportColumnMap::normalize($r), [
            ['sku_produk' => 'RAUJI001', 'sku_varian' => 'RAUJIVAR1', 'harga' => '1750000', 'stok' => '25'],
        ]);

        $hasil = UpdatePreviewDiff::compute($rows, 'stock_price_update', null);
        $this->assertSame(1, $hasil['changed_rows']);
        $this->assertStringContainsString('harga', implode(' ', $hasil['changes']));
        $this->assertStringContainsString('stok', implode(' ', $hasil['changes']));
    }

    public function test_pratinjau_update_lewat_http_tidak_lagi_500(): void
    {
        $this->variantUji();

        $file = $this->buatXlsx([
            ['SKU Produk', 'Nama Produk', 'SKU Varian', 'Variasi', 'Harga', 'Stok', 'Deskripsi Produk', 'Spesifikasi'],
            ['RAUJI001', 'Produk Uji Update', 'RAUJIVAR1', 'Putih', 1750000, 25, 'Deskripsi', 'Bahan: Aluminium'],
        ], 'Update Produk');

        $respons = $this->actingAs($this->admin())->post('/admin/imports/preview-update', [
            'type' => 'stock_price_update',
            'file' => $file,
        ]);

        $respons->assertOk();
        $json = $respons->json();
        $this->assertSame([], $json['verify_errors']);
        $this->assertSame(1, $json['changed_rows']);
        $this->assertNotEmpty($json['changes']);
    }

    /** @param list<list<mixed>> $baris */
    private function buatXlsx(array $baris, string $judul): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($judul);
        $sheet->fromArray($baris, null, 'A1');

        $path = tempnam(sys_get_temp_dir(), 'uji_xlsx_') . '.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return new UploadedFile($path, 'uji-update.xlsx', null, null, true);
    }
}