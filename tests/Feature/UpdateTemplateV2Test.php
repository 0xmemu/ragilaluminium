<?php

namespace Tests\Feature;

use App\Imports\ImportMediaUpdate;
use App\Imports\ImportStockPriceUpdate;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * Importer update membaca header template v2.
 *
 * Kontrak yang dijaga:
 *  - Harga dan stok terbarui dari header v2 (SKU Produk, SKU Varian, Harga, Stok).
 *  - Kolom identitas yang DIUBAH admin tetap DITOLAK; server memvalidasi ulang
 *    walau proteksi Excel dilepas.
 *  - Sel kosong tidak mengubah data.
 */
class UpdateTemplateV2Test extends TestCase
{
    use RefreshDatabase;

    private Product $product;

    private ProductVariant $variant;

    protected function setUp(): void
    {
        parent::setUp();

        // Berkas media harus benar-benar ada supaya URL dikenali sebagai
        // aset internal; tanpa ini URL dianggap eksternal dan ditolak UrlGuard.
        \Illuminate\Support\Facades\Storage::fake("media");
        \Illuminate\Support\Facades\Storage::disk("media")
            ->put("media-assets/varian/pdp.webp", "isi-uji");

        $this->product = Product::create([
            "parent_sku" => "RA-UPD-1",
            "name" => "Produk Update Uji",
            "short_name" => "Produk Update",
            "category_id" => 1,
            "product_category" => "JENDELA",
            "product_model" => "KACA_MATI",
            "design_variant" => "POLOS",
            "status" => "active",
        ]);

        $this->variant = ProductVariant::create([
            "product_id" => $this->product->id,
            "variant_sku" => "RA-UPD-1-A",
            "variation_1_name" => "Warna",
            "variation_1_option" => "Putih",
            "price" => 1000000,
            "stock" => 5,
            "status" => "active",
        ]);
    }

    private function berkas(array $headers, array $rows): string
    {
        $ss = new Spreadsheet();
        $ws = $ss->getActiveSheet();
        foreach ($headers as $i => $h) {
            $ws->setCellValueByColumnAndRow($i + 1, 1, $h);
        }
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $v) {
                $ws->setCellValueByColumnAndRow($c + 1, $r + 2, $v);
            }
        }
        $path = storage_path("app/imports/tmp/upd-v2.xlsx");
        @mkdir(dirname($path), 0775, true);
        (new Xlsx($ss))->save($path);

        return $path;
    }

    /**
     * Job import untuk tipe tertentu.
     *
     * SQLite menerjemahkan enum menjadi CHECK constraint dari definisi tabel
     * awal, sehingga nilai media_update tidak dikenali walau migrasi MySQL
     * sudah menambahkannya. Pola yang sudah dipakai tes lain di repo ini:
     * longgarkan constraint di sqlite saja, tanpa mengubah migrasi produksi.
     */
    private function job(string $type): ImportJob
    {
        $job = ImportJob::create([
            "type" => "internal_bulk_update",
            "source_file_name" => "upd-v2.xlsx",
            "source_file_path" => "tmp/upd-v2.xlsx",
            "stock_mode" => "file",
            "status" => "pending",
            "triggered_by_user_id" => User::factory()->create(["role" => "admin", "status" => "active"])->id,
        ]);

        if (\Illuminate\Support\Facades\DB::connection()->getDriverName() === "sqlite") {
            \Illuminate\Support\Facades\DB::statement("PRAGMA ignore_check_constraints = ON");
        }

        $job->update(["type" => $type]);

        return $job->fresh();
    }

    public function test_update_harga_dan_stok_dari_header_v2(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok", "Deskripsi Produk", "Spesifikasi"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", 1750000, 42, "", ""],
        ]);

        Excel::import(new ImportStockPriceUpdate($this->job("stock_price_update")->id), $path);

        $v = $this->variant->fresh();
        $this->assertEquals(1750000.0, (float) $v->price, "harga terbarui dari kolom v2");
        $this->assertSame(42, (int) $v->stock, "stok terbarui dari kolom v2");
    }

    public function test_sel_kosong_tidak_mengubah_data(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok", "Deskripsi Produk", "Spesifikasi"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "", "", "", ""],
        ]);

        Excel::import(new ImportStockPriceUpdate($this->job("stock_price_update")->id), $path);

        $v = $this->variant->fresh();
        $this->assertEquals(1000000.0, (float) $v->price, "harga tidak berubah saat sel kosong");
        $this->assertSame(5, (int) $v->stock, "stok tidak berubah saat sel kosong");
    }

    public function test_deskripsi_dan_spesifikasi_dari_header_v2(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok", "Deskripsi Produk", "Spesifikasi"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "", "", "Deskripsi baru hasil update.", "Bahan: Aluminium, Kusen: 3 inch, Kualitas: Grade A"],
        ]);

        Excel::import(new ImportStockPriceUpdate($this->job("stock_price_update")->id), $path);

        $p = $this->product->fresh();
        $this->assertSame("Deskripsi baru hasil update.", $p->description, "deskripsi produk terbarui dari kolom v2");
        $attrs = $p->attributes()->whereNull("product_variant_id")
            ->pluck("attribute_value", "attribute_name")->all();
        $this->assertSame(
            ["Bahan" => "Aluminium", "Kusen" => "3 inch", "Kualitas" => "Grade A"],
            $attrs,
            "spesifikasi tersimpan sebagai atribut level produk"
        );
        $this->assertEquals(1000000.0, (float) $this->variant->fresh()->price, "harga tidak berubah saat sel kosong");
    }

    public function test_deskripsi_spesifikasi_kosong_tidak_mengubah(): void
    {
        $this->product->update(["description" => "Deskripsi awal."]);
        \App\Models\ProductAttribute::create([
            "product_id" => $this->product->id,
            "attribute_name" => "Bahan",
            "attribute_value" => "Aluminium",
            "source" => "internal",
        ]);

        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok", "Deskripsi Produk", "Spesifikasi"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "", "", "", ""],
        ]);

        Excel::import(new ImportStockPriceUpdate($this->job("stock_price_update")->id), $path);

        $p = $this->product->fresh();
        $this->assertSame("Deskripsi awal.", $p->description, "deskripsi tidak berubah saat sel kosong");
        $this->assertDatabaseHas("product_attributes", [
            "product_id" => $this->product->id,
            "attribute_name" => "Bahan",
            "attribute_value" => "Aluminium",
        ]);
    }

    public function test_sheet_panduan_tidak_menghasilkan_baris_gagal(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Gambar per Varian", "Gambar 1 (utama)", "Gambar 2", "Media Bersama 1", "Media Bersama 2", "Gambar Hasil Pemasangan 1", "Gambar Hasil Pemasangan 2"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "https://media.333labs.tech/media-assets/varian/pdp.webp", "", "", "", "", "", ""],
        ]);

        // Template asli punya sheet kedua berisi panduan tanpa kolom SKU.
        // Maatwebsite membaca semua sheet, jadi sheet itu WAJIB tidak
        // menghasilkan baris gagal.
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
        $panduan = $ss->createSheet();
        $panduan->setTitle("Panduan Update Media");
        $panduan->setCellValue("A1", "2");
        $panduan->setCellValue("B1", "Ragil Aluminium");
        $panduan->setCellValue("C1", "Panduan Update Media");
        $panduan->setCellValue("A2", "URL foto utama katalog produk.");
        $panduan->setCellValue("B2", "YA");
        $panduan->setCellValue("C2", "Gambar 1 (utama)");
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($ss))->save($path);

        $job = $this->job("media_update");
        Excel::import(new ImportMediaUpdate($job->id), $path);
        $job->refresh();

        $this->assertSame(0, (int) $job->failed_rows, "sheet Panduan tidak boleh menghasilkan baris gagal");
        $this->assertSame(1, (int) $job->success_rows, "baris data di sheet pertama tetap diproses");
    }

    public function test_sku_varian_yang_diubah_admin_ditolak(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok", "Deskripsi Produk", "Spesifikasi"];
        $path = $this->berkas($headers, [
            // SKU varian dipalsukan; server wajib menolak baris ini.
            ["RA-UPD-1", "Produk Update Uji", "RA-DIPALSUKAN", "Putih", 9999999, 99, "", ""],
        ]);

        $job = $this->job("stock_price_update");
        Excel::import(new ImportStockPriceUpdate($job->id), $path);

        $v = $this->variant->fresh();
        $this->assertEquals(1000000.0, (float) $v->price, "harga TIDAK boleh berubah dari baris yang SKU-nya dipalsukan");
        $this->assertGreaterThanOrEqual(1, (int) $job->fresh()->failed_rows, "baris dengan SKU palsu wajib gagal");
    }

    public function test_update_media_v2_menerima_header_baru(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Gambar per Varian", "Gambar 1 (utama)", "Gambar 2", "Media Bersama 1", "Media Bersama 2", "Gambar Hasil Pemasangan 1", "Gambar Hasil Pemasangan 2"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "https://media.333labs.tech/media-assets/varian/pdp.webp", "", "", "", "", "", ""],
        ]);

        $job = $this->job("media_update");
        Excel::import(new ImportMediaUpdate($job->id), $path);

        $this->assertGreaterThanOrEqual(
            1,
            \App\Models\ProductMedia::count(),
            "media per varian wajib tersimpan dari header v2"
        );
    }

    public function test_harga_berformat_ribuan_tersimpan_benar(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "1.250.000", 42],
        ]);

        Excel::import(new ImportStockPriceUpdate($this->job("stock_price_update")->id), $path);

        $this->assertEquals(
            1250000.0,
            (float) $this->variant->fresh()->price,
            "harga format ribuan Indonesia wajib tersimpan sebagai 1250000"
        );
    }

    public function test_harga_nol_ditolak_importer(): void
    {
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Harga", "Stok"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", 0, 42],
        ]);

        $job = $this->job("stock_price_update");
        Excel::import(new ImportStockPriceUpdate($job->id), $path);
        $job->refresh();

        $this->assertSame(1, (int) $job->failed_rows, "harga 0 wajib ditolak per baris");
        $this->assertEquals(
            1000000.0,
            (float) $this->variant->fresh()->price,
            "harga lama tidak berubah saat baris ditolak"
        );
    }

    public function test_gambar_1_dan_2_selalu_level_produk(): void
    {
        \Illuminate\Support\Facades\Storage::disk("media")->put("media-assets/kedua/pdp.webp", "isi-uji");

        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Gambar per Varian", "Gambar 1 (utama)", "Gambar 2", "Media Bersama 1", "Media Bersama 2", "Gambar Hasil Pemasangan 1", "Gambar Hasil Pemasangan 2"];
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "", "https://media.333labs.tech/media-assets/varian/pdp.webp", "https://media.333labs.tech/media-assets/kedua/pdp.webp", "", "", "", ""],
        ]);

        Excel::import(new ImportMediaUpdate($this->job("media_update")->id), $path);

        $levelProduk = \App\Models\ProductMedia::where("product_id", $this->product->id)
            ->whereNull("product_variant_id")->orderBy("position")->get();
        $this->assertSame([1, 2], $levelProduk->pluck("position")->all(), "Gambar 1 dan 2 wajib jadi media level produk");
        $this->assertSame(0, \App\Models\ProductMedia::where("product_variant_id", $this->variant->id)->count(),
            "kolom Gambar 1/2 tidak boleh menempel ke varian (audit P1-3)");
        $this->assertTrue((bool) $levelProduk->firstWhere("position", 1)->is_main_image, "posisi 1 wajib main");
        $this->assertNotNull($this->product->mainImage()->first(), "mainImage produk wajib tetap terisi");
    }

    public function test_media_diarsip_lalu_diisi_ulang_muncul_kembali(): void
    {
        $url = "https://media.333labs.tech/media-assets/varian/pdp.webp";
        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Gambar per Varian", "Gambar 1 (utama)", "Gambar 2", "Media Bersama 1", "Media Bersama 2", "Gambar Hasil Pemasangan 1", "Gambar Hasil Pemasangan 2"];
        $baris = [["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", $url, "", "", "", "", "", ""]];

        // Import pertama: media varian dibuat.
        Excel::import(new ImportMediaUpdate($this->job("media_update")->id), $this->berkas($headers, $baris));
        $media = \App\Models\ProductMedia::where("product_variant_id", $this->variant->id)->firstOrFail();
        $media->update(["visibility" => "archived"]);

        // Import kedua dengan URL sama: kembali visible, tanpa baris kembar.
        Excel::import(new ImportMediaUpdate($this->job("media_update")->id), $this->berkas($headers, $baris));
        $media->refresh();
        $this->assertSame("visible", $media->visibility, "isi ulang URL sama wajib memunculkan kembali media (audit P1-4)");
        $this->assertSame(
            1,
            \App\Models\ProductMedia::where("product_variant_id", $this->variant->id)->count(),
            "isi ulang tidak boleh membuat baris kembar"
        );
    }

    /**
     * Fitur penanda hapus dihapus (keputusan owner 19 Sep 2026): tidak ada
     * skenario admin yang membutuhkannya, dan arsip media cukup lewat panel
     * admin. Sel berisi "hapus" kini GAGAL sebagai URL tidak valid, dan sel
     * kosong tetap tidak mengubah media.
     */
    public function test_kata_hapus_gagal_sebagai_url_dan_sel_kosong_tidak_mengubah(): void
    {
        // Siapkan satu media varian yang aktif.
        $media = \App\Models\ProductMedia::create([
            "product_id" => $this->product->id,
            "product_variant_id" => $this->variant->id,
            "position" => 50,
            "visibility" => "visible",
            "show_in_catalog" => true,
            "source_url" => "https://media.333labs.tech/media-assets/varian/pdp.webp",
            "status" => "downloaded",
        ]);

        $headers = ["SKU Produk", "Nama Produk", "SKU Varian", "Variasi", "Gambar per Varian", "Gambar 1 (utama)", "Gambar 2", "Media Bersama 1", "Media Bersama 2", "Gambar Hasil Pemasangan 1", "Gambar Hasil Pemasangan 2"];

        // 1. Sel KOSONG: media lama wajib tetap terlihat.
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "", "", "", "", "", "", ""],
        ]);
        $jobA = $this->job("media_update");
        Excel::import(new ImportMediaUpdate($jobA->id), $path);
        $this->assertSame("visible", $media->fresh()->visibility, "sel kosong TIDAK boleh menghapus media");

        // 2. Sel berisi "hapus": baris GAGAL sebagai URL tidak valid, media
        // tidak tersentuh sama sekali.
        $path = $this->berkas($headers, [
            ["RA-UPD-1", "Produk Update Uji", "RA-UPD-1-A", "Putih", "hapus", "", "", "", "", "", ""],
        ]);
        $jobB = $this->job("media_update");
        Excel::import(new ImportMediaUpdate($jobB->id), $path);
        $jobB->refresh();
        $this->assertSame(1, (int) $jobB->failed_rows, "kata hapus wajib gagal sebagai URL tidak valid");
        $alasan = (string) \Illuminate\Support\Facades\DB::table("import_job_rows")
            ->where("import_job_id", $jobB->id)
            ->where("status", "failed")
            ->value("error_reason");
        $this->assertStringContainsString("tidak valid", $alasan, "pesan wajib menyebut URL tidak valid");
        $this->assertSame("visible", $media->fresh()->visibility, "template tidak boleh mengarsipkan media");
    }
}
