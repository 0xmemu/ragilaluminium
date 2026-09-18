<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\CatalogTemplateV2;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Template katalog v2: tiga berkas terpisah dengan header Bahasa Indonesia.
 *
 * Kontrak yang dijaga:
 *  - Import Produk: header persis seperti berkas owner, 4 grup warna, sheet
 *    Data/Contoh/Panduan.
 *  - Update Produk dan Update Media: berisi data nyata dari DB, empat kolom
 *    identitas TERKUNCI, dan kolom media KOSONG.
 *  - Filter unduhan menyaring isi berkas.
 */
class CatalogTemplateV2DownloadTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(["role" => "admin", "status" => "active"]);
    }

    /** Buat produk dengan beberapa varian untuk data unduhan. */
    private function produk(string $sku, string $model, string $subModel, int $varian = 2): Product
    {
        $p = Product::create([
            "parent_sku" => $sku,
            "name" => "Produk Uji " . $sku,
            "short_name" => "Produk Uji",
            "category_id" => 1,
            "product_category" => "JENDELA",
            "product_model" => $model,
            "design_variant" => $subModel,
            "status" => "active",
            "description" => "Deskripsi " . $sku,
        ]);

        for ($i = 1; $i <= $varian; $i++) {
            ProductVariant::create([
                "product_id" => $p->id,
                "variant_sku" => $sku . "-V" . $i,
                "price" => 1000000 + $i,
                "stock" => 10 + $i,
                "status" => "active",
                "variation_1_name" => "Warna",
                "variation_1_option" => $i === 1 ? "Putih" : "Hitam",
                "variation_2_name" => "Kaca",
                "variation_2_option" => "Kaca Bening",
            ]);
        }

        return $p;
    }

    /**
     * Isi berkas dari BinaryFileResponse milik Excel::download().
     *
     * Respons unduhan bukan streamed response, dan getContent() kosong untuk
     * berkas biner (pelajaran 11 Sep 2026), sehingga berkas dibaca dari
     * pathname sementara yang dipakai pengiriman.
     */
    private function isiBerkas($res): string
    {
        $file = $res->baseResponse->getFile();

        return (string) file_get_contents($file->getPathname());
    }

    /** Muat berkas xlsx dari isi biner. */
    private function baca(string $konten)
    {
        $tmp = tempnam(sys_get_temp_dir(), "tpl") . ".xlsx";
        file_put_contents($tmp, $konten);

        return IOFactory::load($tmp);
    }

    public function test_import_produk_punya_header_dan_tiga_sheet(): void
    {
        $res = $this->actingAs($this->admin())
            ->get(route("admin.imports.product-import-template"));
        $res->assertOk();

        $ss = $this->baca($this->isiBerkas($res));

        $this->assertSame(["Data", "Contoh", "Panduan"], $ss->getSheetNames());

        $ws = $ss->getSheetByName("Data");
        $harap = [
            "NO. ID", "Nama Produk", "Deskripsi Produk", "Spesifikasi",
            "Kategori Produk", "Model Produk", "Sub Model",
            "Nama Variasi 1", "Opsi Variasi 1", "Gambar per Varian",
            "Nama Variasi 2", "Opsi Variasi 2",
            "Harga", "Stok", "Berat (Kg)", "Tinggi (cm)", "Panjang (cm)", "Lebar (cm)",
            "Gambar 1 (utama)", "Gambar 2", "Media Bersama 1", "Media Bersama 2",
            "Gambar Hasil Pemasangan 1", "Gambar Hasil Pemasangan 2",
        ];
        foreach ($harap as $i => $header) {
            $this->assertSame(
                $header,
                (string) $ws->getCellByColumnAndRow($i + 1, 1)->getValue(),
                "header kolom " . ($i + 1) . " wajib persis"
            );
        }

        $this->assertCount(24, $harap, "jumlah kolom kontrak");
    }

    public function test_import_produk_memakai_warna_per_grup(): void
    {
        $res = $this->actingAs($this->admin())
            ->get(route("admin.imports.product-import-template"));
        $ss = $this->baca($this->isiBerkas($res));
        $ws = $ss->getSheetByName("Data");

        $warna = [];
        foreach (CatalogTemplateV2::importColumns() as $i => $col) {
            $warna[$col["group"]] = $ws->getCellByColumnAndRow($i + 1, 1)
                ->getStyle()->getFill()->getStartColor()->getARGB();
        }

        // Empat grup wajib punya warna berbeda satu sama lain.
        $this->assertCount(4, $warna, "empat grup fungsi");
        $this->assertCount(4, array_unique($warna), "warna tiap grup wajib berbeda");
    }

    public function test_update_produk_berisi_data_nyata_dan_kolom_identitas_terkunci(): void
    {
        $this->produk("RA-TPL-1", "SWING_1_DAUN", "POLOS");

        $res = $this->actingAs($this->admin())
            ->get(route("admin.imports.stock-price-template"));
        $res->assertOk();

        $ss = $this->baca($this->isiBerkas($res));
        $this->assertSame(["Update Produk", "Panduan"], $ss->getSheetNames());

        $ws = $ss->getSheetByName("Update Produk");

        // Data nyata: baris pertama memuat SKU produk dan varian dari DB.
        $this->assertSame("RA-TPL-1", (string) $ws->getCell("A2")->getValue());
        $this->assertSame("RA-TPL-1-V1", (string) $ws->getCell("C2")->getValue());
        $this->assertSame("Putih, Kaca Bening", (string) $ws->getCell("D2")->getValue());

        // Kolom boleh-ubah terisi nilai sekarang.
        $this->assertEquals(1000001, (float) $ws->getCell("E2")->getValue());
        $this->assertEquals(11, (int) $ws->getCell("F2")->getValue());

        // Empat kolom identitas terkunci, kolom lain terbuka.
        foreach (["A", "B", "C", "D"] as $kolom) {
            $this->assertSame(
                "protected",
                $ws->getCell($kolom . "2")->getStyle()->getProtection()->getLocked(),
                "kolom " . $kolom . " wajib terkunci"
            );
        }
        foreach (["E", "F", "G", "H"] as $kolom) {
            $this->assertSame(
                "unprotected",
                $ws->getCell($kolom . "2")->getStyle()->getProtection()->getLocked(),
                "kolom " . $kolom . " wajib bisa diubah"
            );
        }
    }

    public function test_update_media_kolom_media_dikosongkan_dan_identitas_terkunci(): void
    {
        $this->produk("RA-TPL-2", "ZIGZAG", "ORNAMEN");

        $res = $this->actingAs($this->admin())
            ->get(route("admin.imports.media-update-template"));
        $res->assertOk();

        $ss = $this->baca($this->isiBerkas($res));
        $this->assertSame(["Update Media", "Panduan"], $ss->getSheetNames());

        $ws = $ss->getSheetByName("Update Media");
        $this->assertSame("RA-TPL-2", (string) $ws->getCell("A2")->getValue());

        // Seluruh kolom media E sampai K wajib KOSONG saat diunduh.
        foreach (range(5, 11) as $c) {
            $this->assertNull(
                $ws->getCellByColumnAndRow($c, 2)->getValue(),
                "kolom media ke-" . $c . " wajib kosong supaya tidak tertimpa"
            );
        }

        foreach (["A", "B", "C", "D"] as $kolom) {
            $this->assertSame(
                "protected",
                $ws->getCell($kolom . "2")->getStyle()->getProtection()->getLocked(),
                "kolom " . $kolom . " wajib terkunci"
            );
        }
    }

    public function test_filter_menyaring_isi_unduhan(): void
    {
        $this->produk("RA-TPL-A", "SWING_1_DAUN", "POLOS");
        $this->produk("RA-TPL-B", "ZIGZAG", "ORNAMEN");

        $res = $this->actingAs($this->admin())
            ->get(route("admin.imports.stock-price-template", ["model" => "ZIGZAG"]));
        $res->assertOk();

        $ss = $this->baca($this->isiBerkas($res));
        $ws = $ss->getSheetByName("Update Produk");

        $skus = [];
        for ($r = 2; $r <= $ws->getHighestRow(); $r++) {
            $sku = trim((string) $ws->getCell("A" . $r)->getValue());
            if ($sku !== "") {
                $skus[$sku] = true;
            }
        }

        $this->assertArrayHasKey("RA-TPL-B", $skus, "produk model ZIGZAG wajib ada");
        $this->assertArrayNotHasKey("RA-TPL-A", $skus, "produk model lain wajib tersaring keluar");
    }

    /**
     * Proteksi sheet TIDAK BOLEH mengunci pengaturan tampilan.
     *
     * Regresi yang pernah terjadi: memanggil setSheet(true) saja mengunci
     * pengaturan lebar kolom, tinggi baris, sort, dan autofilter, karena pada
     * OOXML atribut bernilai 1 berarti DIKUNCI dan bawaannya true. Akibatnya
     * admin tidak bisa melebarkan kolom untuk membaca data, dan autofilter
     * yang dipasang eksportir tidak bisa dipakai.
     *
     * Aturan yang dijaga: <b>tampilan boleh diatur, struktur tidak boleh</b>.
     */
    public function test_proteksi_mengizinkan_atur_tampilan_dan_mengunci_struktur(): void
    {
        $this->produk("RA-TPL-P1", "ZIGZAG", "ORNAMEN");

        $res = $this->actingAs($this->admin())
            ->get(route("admin.imports.stock-price-template"));
        $res->assertOk();

        $isi = $this->isiBerkas($res);
        $tmp = tempnam(sys_get_temp_dir(), "prot") . ".xlsx";
        file_put_contents($tmp, $isi);

        // Baca XML mentah: satu-satunya cara memastikan arti atribut proteksi,
        // karena PhpSpreadsheet mengembalikan nilai yang sama untuk null dan
        // false sehingga tidak bisa membedakan mana yang benar-benar diizinkan.
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($tmp) === true, "berkas xlsx wajib bisa dibuka");
        $xml = (string) $zip->getFromName("xl/worksheets/sheet1.xml");
        $zip->close();

        $this->assertMatchesRegularExpression(
            '/sheetProtection[^>]*sheet="1"/',
            $xml,
            "sheet wajib diproteksi"
        );

        // Tampilan: WAJIB diizinkan (0).
        foreach (["formatCells", "formatColumns", "formatRows", "sort", "autoFilter"] as $izin) {
            $this->assertMatchesRegularExpression(
                '/sheetProtection[^>]*' . $izin . '="0"/',
                $xml,
                $izin . " wajib diizinkan supaya admin bisa mengatur tampilan"
            );
        }

        // Struktur: WAJIB tetap dikunci (1).
        foreach (["insertColumns", "deleteColumns", "insertRows", "deleteRows"] as $kunci) {
            $this->assertMatchesRegularExpression(
                '/sheetProtection[^>]*' . $kunci . '="1"/',
                $xml,
                $kunci . " wajib dikunci supaya struktur kolom tidak bergeser"
            );
        }
    }
}
