<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\CatalogImportVerifierV2;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * Importer katalog format v2 (satu baris = satu varian).
 *
 * Kontrak yang dijaga:
 *  - Satu grup NO. ID menjadi satu produk; jumlah baris = jumlah varian.
 *  - Nama produk dipakai APA ADANYA, tidak digenerate dari dimensi.
 *  - Lebar (cm) masuk ke depth_cm, Tinggi ke height_cm, Panjang ke width_cm.
 *  - Gambar per varian di-dedupe per nilai opsi.
 *  - Verifikasi menolak berkas yang melanggar aturan sebelum membuat produk.
 */
class CatalogImportV2Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Berkas media harus benar-benar ada supaya URL dikenali internal.
        $this->siapkanMedia([
            "media-assets/varian-putih/pdp.webp",
            "media-assets/varian-hitam/pdp.webp",
            "media-assets/utama/pdp.webp",
        ]);
    }


    /**
     * Siapkan berkas nyata di disk media.
     *
     * URL media.333labs.tech hanya dikenali sebagai aset internal bila
     * berkasnya benar-benar ada. Tanpa ini, URL dianggap eksternal lalu ditolak
     * UrlGuard (benar secara keamanan, tetapi membuat tes tidak menguji media).
     */
    private function siapkanMedia(array $paths): void
    {
        \Illuminate\Support\Facades\Storage::fake("media");
        foreach ($paths as $path) {
            \Illuminate\Support\Facades\Storage::disk("media")->put($path, "isi-uji");
        }
    }

    /** Tambah berkas uji pada disk media yang sudah di-fake di setUp. */
    private function tambahMedia(array $paths): void
    {
        foreach ($paths as $path) {
            \Illuminate\Support\Facades\Storage::disk("media")->put($path, "isi-uji");
        }
    }

    private function urlMedia(string $path): string
    {
        return "https://media.333labs.tech/" . $path;
    }

    /** Susun baris data format v2 untuk satu produk. */
    private function baris(array $override = []): array
    {
        return array_merge([
            "no_id" => 1,
            "nama_produk" => "Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing",
            "deskripsi_produk" => "Deskripsi produk uji.",
            "spesifikasi" => "Bahan: Aluminium, Kusen: 3 inch",
            "kategori_produk" => "JENDELA",
            "model_produk" => "KACA_MATI",
            "sub_model" => "POLOS",
            "nama_variasi_1" => "Warna",
            "opsi_variasi_1" => "Putih",
            "gambar_per_varian" => $this->urlMedia('media-assets/varian-putih/pdp.webp'),
            "nama_variasi_2" => "Kaca",
            "opsi_variasi_2" => "Kaca Bening",
            "harga" => 1250000,
            "stok" => 10,
            "berat_kg" => 12.5,
            "tinggi_cm" => 170,
            "panjang_cm" => 60,
            "lebar_cm" => 20,
            "gambar_1_utama" => $this->urlMedia('media-assets/utama/pdp.webp'),
        ], $override);
    }

    /**
     * Tulis berkas xlsx sementara dari daftar baris, memakai penulis
     * PhpSpreadsheet langsung supaya header berkas benar-benar berisi slug
     * format v2 (bukan hasil eksportir, agar importer diuji apa adanya).
     */
    private function berkas(array $rows): string
    {
        $ss = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $ss->getActiveSheet();
        $ws->setTitle("Data");

        $headers = array_keys($rows[0]);
        foreach ($headers as $i => $header) {
            $ws->setCellValue(
                \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1) . "1",
                $header
            );
        }
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $ws->setCellValue(
                    \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c + 1) . ($r + 2),
                    $value
                );
            }
        }

        $path = \Illuminate\Support\Facades\Storage::disk("imports")->path("tmp/uji-v2.xlsx");
        @mkdir(dirname($path), 0775, true);
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($ss))->save($path);

        return $path;
    }

    private function job(string $type = "catalog_import"): ImportJob
    {
        return ImportJob::create([
            "type" => $type,
            "source_file_name" => "uji.xlsx",
            "source_file_path" => "tmp/uji.xlsx",
            "stock_mode" => "file",
            "status" => "pending",
            "triggered_by_user_id" => User::factory()->create(["role" => "admin", "status" => "active"])->id,
        ]);
    }

    public function test_verifier_v2_menolak_berkas_tanpa_foto_utama(): void
    {
        $rows = [$this->baris(["gambar_1_utama" => ""])];
        $errors = CatalogImportVerifierV2::verify($rows);

        $this->assertNotEmpty($errors);
        $this->assertStringContainsString("Gambar 1 (utama)", implode(" ", $errors));
    }

    public function test_verifier_v2_menolak_harga_nol_dan_kombinasi_duplikat(): void
    {
        $errors = CatalogImportVerifierV2::verify([
            $this->baris(["harga" => 0]),
            $this->baris([]),
        ]);

        $pesan = implode(" | ", $errors);
        $this->assertStringContainsString("Harga kosong, tidak valid, atau nol", $pesan);
        $this->assertStringContainsString("duplikat", $pesan);
    }

    public function test_import_v2_membuat_satu_produk_dengan_beberapa_varian(): void
    {
        $rows = [
            $this->baris([]),
            $this->baris(["opsi_variasi_1" => "Hitam", "gambar_per_varian" => $this->urlMedia('media-assets/varian-hitam/pdp.webp')]),
            $this->baris(["opsi_variasi_1" => "Putih", "opsi_variasi_2" => "Kaca Es", "gambar_per_varian" => $this->urlMedia('media-assets/varian-putih/pdp.webp')]),
        ];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $this->assertSame(1, Product::count(), "satu grup NO. ID = satu produk");
        $this->assertSame(3, ProductVariant::count(), "tiga baris = tiga varian");

        $product = Product::first();
        $this->assertSame("Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing", $product->name);
        $this->assertStringNotContainsString("175", (string) $product->name);
    }

    public function test_import_v2_memetakan_dimensi_sesuai_kontrak(): void
    {
        $rows = [$this->baris(["tinggi_cm" => 170, "panjang_cm" => 60, "lebar_cm" => 20, "berat_kg" => 12.5])];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::first();
        $this->assertEquals(170.0, (float) $product->height_cm, "Tinggi ke height_cm");
        $this->assertEquals(60.0, (float) $product->width_cm, "Panjang ke width_cm");
        $this->assertEquals(20.0, (float) $product->depth_cm, "Lebar ke depth_cm");
        $this->assertEquals(12.5, (float) $product->weight_kg, "Berat ke weight_kg");
    }

    public function test_import_v2_harga_dan_stok_masuk_ke_varian(): void
    {
        $rows = [$this->baris(["harga" => 1250000, "stok" => 10])];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $variant = ProductVariant::first();
        $this->assertEquals(1250000.0, (float) $variant->price);
        $this->assertSame(10, (int) $variant->stock);
        $this->assertSame("Putih", $variant->variation_1_option);
        $this->assertSame("Kaca Bening", $variant->variation_2_option);
    }

    public function test_import_v2_menyimpan_spesifikasi_sebagai_atribut(): void
    {
        $rows = [$this->baris(["spesifikasi" => "Bahan: Aluminium, Kusen: 3 inch"])];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::first();
        $attrs = $product->attributes()->pluck("attribute_value", "attribute_name")->all();

        $this->assertSame("Aluminium", $attrs["Bahan"] ?? null);
        $this->assertSame("3 inch", $attrs["Kusen"] ?? null);
    }

    /**
     * Baris wajib SUKSES, bukan hanya produknya terbentuk.
     *
     * Celah yang pernah terjadi: produk dan varian terbuat sehingga tes produk
     * tetap lulus, padahal barisnya gagal di tahap media. Tes ini mengunci
     * hitungan baris sukses dan jumlah media yang benar-benar tersimpan.
     */
    public function test_semua_baris_sukses_dan_media_tersimpan(): void
    {
        $rows = [
            $this->baris([]),
            $this->baris(["opsi_variasi_1" => "Hitam", "gambar_per_varian" => $this->urlMedia("media-assets/varian-hitam/pdp.webp")]),
        ];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $job->refresh();
        $this->assertSame(2, (int) $job->success_rows, "semua baris wajib sukses");
        $this->assertSame(0, (int) $job->failed_rows, "tidak boleh ada baris gagal");

        $this->assertGreaterThan(
            0,
            \App\Models\ProductMedia::count(),
            "media wajib tersimpan dari URL di berkas"
        );
    }


    public function test_gambar_3_masuk_galeri_katalog_posisi_3(): void
    {
        // Disk media sudah di-fake di setUp; tambahkan berkas tanpa mem-fake
        // ulang supaya root disk tidak tergantikan.
        $this->tambahMedia([
            "media-assets/kedua/pdp.webp",
            "media-assets/ketiga/pdp.webp",
        ]);

        $rows = [
            $this->baris([
                "gambar_2" => $this->urlMedia("media-assets/kedua/pdp.webp"),
                "gambar_3" => $this->urlMedia("media-assets/ketiga/pdp.webp"),
            ]),
        ];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::firstOrFail();
        $galeri = $product->media()
            ->where("is_installation", false)
            ->whereNull("product_variant_id")
            ->orderBy("position")
            ->get();

        $this->assertSame(
            [1, 2, 3],
            $galeri->pluck("position")->all(),
            "galeri katalog wajib memuat posisi 1, 2, dan 3"
        );
        $this->assertTrue(
            (bool) $galeri->firstWhere("position", 1)->is_main_image,
            "posisi 1 wajib gambar utama"
        );
        $this->assertSame(
            $this->urlMedia("media-assets/ketiga/pdp.webp"),
            $galeri->firstWhere("position", 3)->source_url,
            "posisi 3 wajib berasal dari kolom Gambar 3"
        );
    }

    public function test_url_sama_di_gambar_2_dan_pemasangan_jadi_dua_baris(): void
    {
        $this->tambahMedia([
            "media-assets/kedua/pdp.webp",
            "media-assets/ketiga/pdp.webp",
            "media-assets/pasang-dua/pdp.webp",
        ]);

        $urlBersama = $this->urlMedia("media-assets/kedua/pdp.webp");
        $rows = [
            $this->baris([
                "gambar_2" => $urlBersama,
                "gambar_3" => $this->urlMedia("media-assets/ketiga/pdp.webp"),
                "gambar_hasil_pemasangan_1" => $urlBersama,
                "gambar_hasil_pemasangan_2" => $this->urlMedia("media-assets/pasang-dua/pdp.webp"),
            ]),
        ];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::firstOrFail();

        $this->assertDatabaseHas("product_media", [
            "product_id" => $product->id,
            "source_url" => $urlBersama,
            "show_in_catalog" => true,
            "is_installation" => false,
            "position" => 2,
        ]);
        $this->assertDatabaseHas("product_media", [
            "product_id" => $product->id,
            "source_url" => $urlBersama,
            "show_in_catalog" => false,
            "is_installation" => true,
        ]);

        $galeri = $product->media()
            ->where("is_installation", false)
            ->whereNull("product_variant_id")
            ->orderBy("position")
            ->get();
        $this->assertSame(
            [1, 2, 3],
            $galeri->pluck("position")->all(),
            "URL bersama dengan pemasangan tidak boleh keluar dari galeri katalog"
        );
    }

    /**
     * Bentuk respons Periksa file WAJIB sama dengan format lain.
     *
     * Regresi yang pernah terjadi: endpoint preview v2 mengirim kunci
     * ok/errors/total_rows, sedangkan frontend membaca verify_errors dan total.
     * Server menjawab 200, tetapi halaman gagal merender dan admin melihat
     * layar gangguan sementara padahal server sukses. Bug seperti ini tidak
     * terlihat dari uji status HTTP saja.
     */
    public function test_verifier_v2_menolak_baris_produk_yang_sudah_ada(): void
    {
        \App\Models\Product::create([
            "parent_sku" => "RA-EXIST-1",
            "name" => "Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing",
            "category_id" => 1,
            "product_category" => "JENDELA",
            "product_model" => "KACA_MATI",
            "design_variant" => "POLOS",
            "status" => "active",
        ]);

        $errors = CatalogImportVerifierV2::verify([$this->baris()]);

        $this->assertNotEmpty($errors, "produk existing wajib ditolak (audit P1-1)");
        $this->assertStringContainsString("sudah ada", $errors[0]);
        $this->assertStringContainsString("RA-EXIST-1", $errors[0], "pesan wajib menyebut SKU existing");
        $this->assertStringContainsString("template Update", $errors[0]);
    }

    public function test_import_v2_gagal_total_bila_produk_sudah_ada(): void
    {
        \App\Models\Product::create([
            "parent_sku" => "RA-EXIST-2",
            "name" => "Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing",
            "category_id" => 1,
            "product_category" => "JENDELA",
            "product_model" => "KACA_MATI",
            "design_variant" => "POLOS",
            "status" => "active",
        ]);

        $rows = [$this->baris(), $this->baris(["opsi_variasi_1" => "Hitam"])];
        $job = $this->job();
        $path = $this->berkas($rows);

        try {
            Excel::import(new CatalogProductsImportV2($job->id, $path), $path);
            $this->fail("import wajib gagal saat produk sudah ada");
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString("File gagal verifikasi", $e->getMessage());
        }

        $this->assertSame(1, Product::count(), "all-or-nothing: tidak ada produk tambahan");
    }

    public function test_verifier_v2_mengabaikan_produk_archived_dengan_nama_sama(): void
    {
        \App\Models\Product::create([
            "parent_sku" => "RA-EXIST-3",
            "name" => "Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing",
            "category_id" => 1,
            "product_category" => "JENDELA",
            "product_model" => "KACA_MATI",
            "design_variant" => "POLOS",
            "status" => "archived",
        ]);

        $errors = CatalogImportVerifierV2::verify([$this->baris()]);

        $this->assertStringNotContainsString(
            "sudah ada",
            implode(" | ", $errors),
            "produk archived tidak menghalangi pembuatan baru"
        );
    }

    public function test_verifier_v2_menolak_dua_grup_identitas_sama_dalam_satu_berkas(): void
    {
        $errors = CatalogImportVerifierV2::verify([
            $this->baris(),
            $this->baris(["no_id" => 2, "opsi_variasi_1" => "Hitam"]),
        ]);

        $pesan = implode(" | ", $errors);
        $this->assertStringContainsString("duplikat dengan grup", $pesan);
    }

    public function test_harga_berformat_ribuan_tersimpan_benar(): void
    {
        $rows = [$this->baris(["harga" => "1.250.000"])];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $product = Product::firstOrFail();
        $this->assertEquals(
            1250000.0,
            (float) $product->activeVariants()->first()->price,
            "harga format ribuan Indonesia wajib tersimpan sebagai 1250000"
        );
    }

    public function test_bentuk_respons_preview_v2_dibaca_frontend(): void
    {
        $path = $this->berkas([$this->baris([])]);

        $upload = new \Illuminate\Http\UploadedFile(
            $path,
            "produk.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            null,
            true
        );

        $res = $this->actingAs($this->job()->triggeredBy)
            ->post(route("admin.imports.preview-catalog"), ["file" => $upload]);
        $res->assertOk();

        $data = json_decode($res->getContent(), true);
        $this->assertIsArray($data);

        foreach (["verify_errors", "total"] as $kunci) {
            $this->assertArrayHasKey(
                $kunci,
                $data,
                "respons preview wajib memuat kunci " . $kunci . " karena dibaca frontend"
            );
        }

        $this->assertIsArray($data["verify_errors"], "verify_errors wajib array");
        $this->assertSame(1, $data["total"], "total menghitung baris TERISI, bukan baris kosong template");
    }

    /**
     * Progres job WAJIB berjalan: processed_rows naik bersama success_rows.
     *
     * Regresi yang pernah terjadi: importer v2 tidak pernah menaikkan
     * processed_rows, sehingga halaman detail job selalu menampilkan 0 persen
     * walau barisnya sudah diproses.
     */
    public function test_progres_job_naik_saat_baris_diproses(): void
    {
        $rows = [
            $this->baris([]),
            $this->baris(["opsi_variasi_1" => "Hitam", "gambar_per_varian" => $this->urlMedia("media-assets/varian-hitam/pdp.webp")]),
        ];

        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $job->refresh();
        $this->assertSame(2, (int) $job->processed_rows, "processed_rows wajib naik mengikuti baris");
        $this->assertSame(2, (int) $job->success_rows);
    }

    /**
     * store() wajib mencatat total_rows sesuai format v2.
     *
     * Regresi yang pernah terjadi: penghitung baris membaca kolom format lama
     * (name, parent_sku, option_1), sehingga berkas v2 tercatat 0 baris dan
     * progres job tidak pernah benar.
     */
    public function test_store_mencatat_total_rows_format_v2(): void
    {
        $rows = [
            $this->baris([]),
            $this->baris(["opsi_variasi_1" => "Hitam"]),
        ];
        $path = $this->berkas($rows);

        $upload = new \Illuminate\Http\UploadedFile(
            $path,
            "produk.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            null,
            true
        );

        $this->actingAs($this->job()->triggeredBy)
            ->post(route("admin.imports.store"), [
                "type" => "catalog_import",
                "file" => $upload,
            ]);

        $job = \App\Models\ImportJob::query()->latest("id")->first();
        $this->assertSame(2, (int) $job->total_rows, "total_rows wajib 2, bukan 0");
    }

    /**
     * Penghitung berjalan WAJIB dipublikasikan ke cache supaya halaman detail
     * job bisa menampilkan progres live.
     *
     * Regresi yang pernah terjadi: importer hanya mengandalkan tabel
     * import_jobs. Karena import berjalan di dalam satu transaksi database,
     * penulisan itu belum terlihat oleh request HTTP lain (isolasi MVCC
     * MySQL), sehingga angka di halaman diam di nol lalu melompat ke nilai
     * akhir saat import selesai.
     */
    public function test_penghitung_berjalan_dipublikasikan_ke_cache(): void
    {
        $rows = [
            $this->baris([]),
            $this->baris(["opsi_variasi_1" => "Hitam", "gambar_per_varian" => $this->urlMedia("media-assets/varian-hitam/pdp.webp")]),
        ];

        $job = $this->job();
        $path = $this->berkas($rows);

        \Illuminate\Support\Facades\Cache::forget("import_counters_{$job->id}");
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $cache = \Illuminate\Support\Facades\Cache::get("import_counters_{$job->id}");
        $this->assertIsArray($cache, "penghitung berjalan wajib ada di cache");
        $this->assertSame(2, (int) $cache["processed_rows"]);
        $this->assertSame(2, (int) $cache["success_rows"]);
        $this->assertSame(0, (int) $cache["failed_rows"]);
        $this->assertSame(1, (int) $cache["processed_products"], "satu produk dari dua baris varian");
        $this->assertSame("running", $cache["status"], "status ikut dipublikasikan supaya label ikut hidup");
    }

    /**
     * Halaman detail job memakai angka cache saat status masih berjalan,
     * sehingga penghitung sukses ikut bergerak bersama progress bar.
     */
    public function test_halaman_detail_memakai_angka_berjalan(): void
    {
        $job = $this->job();
        $job->update(["status" => "running", "total_rows" => 3, "processed_rows" => 0, "success_rows" => 0]);

        \Illuminate\Support\Facades\Cache::put("import_counters_{$job->id}", [
            "status" => "running",
            "processed_rows" => 2,
            "success_rows" => 2,
            "failed_rows" => 0,
            "processed_products" => 1,
        ], 600);

        $res = $this->actingAs($job->triggeredBy)
            ->get(route("admin.imports.show", $job));

        $res->assertOk()->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->component("Admin/ImportShow")
            ->where("importJob.processed_rows", 2)
            ->where("importJob.success_rows", 2)
            ->where("importJob.processed_products", 1)
        );
    }

    /**
     * Halaman detail job memuat daftar produk yang berhasil diimpor.
     */
    public function test_halaman_detail_memuat_daftar_produk_berhasil(): void
    {
        $rows = [$this->baris([])];
        $job = $this->job();
        $path = $this->berkas($rows);
        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);

        $job->refresh();
        $job->update(["status" => "completed"]);

        $res = $this->actingAs($job->triggeredBy)
            ->get(route("admin.imports.show", $job));

        $res->assertOk()->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->component("Admin/ImportShow")
            ->has("importJob.imported_products", 1)
            ->where("importJob.imported_products.0.sku", fn ($sku) => is_string($sku) && $sku !== "")
        );
    }

    /**
     * Halaman detail import WAJIB mengirim backUrl supaya tombol Kembali
     * dirender layout.
     *
     * Regresi yang pernah terjadi: backUrl hanya dikirim di create(), tidak di
     * show(), sehingga halaman detail tidak punya jalan kembali ke daftar
     * import selain tombol Riwayat import di kanan atas.
     */
    public function test_halaman_detail_import_mengirim_back_url(): void
    {
        $job = $this->job();
        $job->update(["status" => "completed"]);

        $this->actingAs($job->triggeredBy)
            ->get(route("admin.imports.show", $job))
            ->assertOk()
            ->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
                ->component("Admin/ImportShow")
                ->where("backUrl", route("admin.imports.index"))
            );
    }
}
