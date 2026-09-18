<?php

namespace App\Exports;

use App\Models\SubModel;
use App\Support\CatalogLabels;
use App\Support\CatalogTemplateV2;
use App\Support\CatalogTemplateV2Styler;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;

/**
 * Template Import Produk v2 (produk dan varian baru).
 *
 * Tiga sheet: Data (diproses importer) / Contoh (ilustrasi terisi lengkap) /
 * Panduan (kamus kolom). Satu baris = satu varian.
 *
 * Perbedaan dari template lama: header Bahasa Indonesia, tidak ada kolom opsi
 * 1 sampai 4, dan kolom dimensi memakai sebutan Tinggi/Panjang/Lebar dengan
 * Lebar dipetakan ke depth_cm sistem (keputusan owner: kedalaman itu lebar).
 */
class ProductImportTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        // Urutan penting: Data WAJIB sheet pertama karena dibaca importer.
        return [
            new ProductImportDataSheet(),
            new ProductImportExampleSheet(),
            new ProductImportGuideSheet(),
        ];
    }

    /** @return list<array{header: string, slug: string, group: int}> */
    public static function columns(): array
    {
        return CatalogTemplateV2::importColumns();
    }

    /** @return list<string> */
    public static function headers(): array
    {
        return CatalogTemplateV2::headers(self::columns());
    }

    /** Peta slug ke indeks kolom 0-based, untuk menyusun baris contoh. */
    public static function slugIndexes(): array
    {
        $out = [];
        foreach (self::columns() as $i => $col) {
            $out[$col['slug']] = $i;
        }

        return $out;
    }

    public static function columnCount(): int
    {
        return count(self::columns());
    }
}

/**
 * Sheet 1: Data. Murni header, tanpa baris contoh, supaya admin mengisi bersih.
 */
class ProductImportDataSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        return [ProductImportTemplateExport::headers()];
    }

    public function title(): string
    {
        return 'Data';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $columns = ProductImportTemplateExport::columns();

        CatalogTemplateV2Styler::styleHeader($sheet, $columns);
        CatalogTemplateV2Styler::applyWidths($sheet, self::widths());
        CatalogTemplateV2Styler::applyAutoFilter($sheet, count($columns));
        // Kolom NO. ID diberi format teks supaya angka tidak berubah bentuk.
        CatalogTemplateV2Styler::forceTextColumns($sheet, [1], 200);
        // Catatan: sheet ini TIDAK diproteksi. Guard kolom identitas diminta
        // owner untuk template Update (yang SKU-nya sudah terisi), sedangkan di
        // sini admin mengisi semua kolom dari nol. Proteksi juga menulis sel
        // untuk seluruh area data sehingga berkas membengkak tanpa manfaat.

        // Dropdown dari data yang benar-benar ada, bukan daftar tetap, supaya
        // model dan sub model baru ikut otomatis tanpa mengubah kode.
        $letters = CatalogTemplateV2::lettersBySlug($columns);
        CatalogTemplateV2Styler::listValidation($sheet, $letters['kategori_produk'], self::categoryOptions(), 500);
        CatalogTemplateV2Styler::listValidation($sheet, $letters['model_produk'], CatalogLabels::modelCodes(), 500);
        CatalogTemplateV2Styler::listValidation($sheet, $letters['sub_model'], self::subModelCodes(), 500);
    }

    /**
     * Daftar sub model untuk dropdown. Dibaca dari database supaya sub model
     * baru ikut muncul tanpa mengubah kode.
     *
     * @return list<string>
     */
    public static function subModelCodes(): array
    {
        return SubModel::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->pluck('code')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Daftar kategori untuk dropdown.
     *
     * Nilai legacy berbahasa Inggris (WINDOW, DOOR, BOUVEN) dibuang karena
     * template memakai kode Indonesia, dan keduanya menunjuk kategori yang
     * sama sehingga muncul dua kali di dropdown.
     *
     * @return list<string>
     */
    public static function categoryOptions(): array
    {
        return array_values(array_unique(array_filter(
            CatalogLabels::categoryCodes(),
            static fn ($code) => ! in_array($code, ['WINDOW', 'DOOR', 'BOUVEN'], true)
        )));
    }

    /** @return array<string, int> */
    public static function widths(): array
    {
        return [
            'A' => 10, 'B' => 40, 'C' => 44, 'D' => 30, 'E' => 18,
            'F' => 18, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 42,
            'K' => 14, 'L' => 14, 'M' => 14, 'N' => 10, 'O' => 11,
            'P' => 11, 'Q' => 11, 'R' => 11, 'S' => 42, 'T' => 42,
            'U' => 42, 'V' => 42, 'W' => 42, 'X' => 42,
        ];
    }
}

/**
 * Sheet 2: Contoh. Ilustrasi TERISI LENGKAP supaya admin melihat bentuk yang
 * benar, termasuk harga, stok, berat, dimensi, dan URL media. Contoh kosong
 * pernah memicu salah isi kolom dimensi, karena itu baris ini sengaja penuh.
 */
class ProductImportExampleSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $headers = ProductImportTemplateExport::headers();
        $rows = [
            ['CONTOH PENGISIAN. Jangan diubah menjadi data produksi.'],
            ['Salin polanya ke sheet Data, atau hapus sheet Contoh ini sebelum import.'],
            $headers,
        ];

        foreach (self::sampleRows() as $row) {
            $rows[] = $row;
        }

        return $rows;
    }

    public function title(): string
    {
        return 'Contoh';
    }

    /**
     * 12 baris contoh: 1 produk, 4 warna x 3 kaca. Baris pertama lengkap,
     * sisanya mengulang identitas yang sama seperti pola isian admin.
     *
     * @return list<list<mixed>>
     */
    public static function sampleRows(): array
    {
        $idx = ProductImportTemplateExport::slugIndexes();
        $rows = [];

        $warna = ['Putih', 'Hitam', 'Cokelat', 'Serat Kayu'];
        $kaca = ['Kaca Bening', 'Kaca Riben', 'Kaca Es'];
        $harga = 1250000;
        $stok = 10;
        $berat = 12.5;
        $tinggi = 170;
        $panjang = 60;
        $lebar = 20;

        $row = 0;
        foreach ($warna as $w) {
            foreach ($kaca as $k) {
                $row++;
                $line = array_fill(0, ProductImportTemplateExport::columnCount(), null);
                $line[$idx['no_id']] = 1;
                $line[$idx['nama_produk']] = 'Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing';
                $line[$idx['deskripsi_produk']] = 'Jendela aluminium dengan garansi 100% pengembalian barang dan dana.';
                $line[$idx['spesifikasi']] = 'Bahan: Aluminium, Kusen: 3 inch, Kaca: 5mm';
                $line[$idx['kategori_produk']] = 'JENDELA';
                $line[$idx['model_produk']] = 'KACA_MATI';
                $line[$idx['sub_model']] = 'POLOS';
                $line[$idx['nama_variasi_1']] = 'Warna';
                $line[$idx['opsi_variasi_1']] = $w;
                $line[$idx['gambar_per_varian']] = self::sampleUrl('warna-'.strtolower(str_replace(' ', '-', $w)));
                $line[$idx['nama_variasi_2']] = 'Kaca';
                $line[$idx['opsi_variasi_2']] = $k;
                $line[$idx['harga']] = $harga;
                $line[$idx['stok']] = $stok;
                $line[$idx['berat_kg']] = $berat;
                $line[$idx['tinggi_cm']] = $tinggi;
                $line[$idx['panjang_cm']] = $panjang;
                $line[$idx['lebar_cm']] = $lebar;
                $line[$idx['gambar_1_utama']] = $row === 1 ? self::sampleUrl('utama') : null;
                $line[$idx['gambar_2']] = $row === 1 ? self::sampleUrl('tampak-depan') : null;
                $line[$idx['gambar_3']] = $row === 1 ? self::sampleUrl('tampak-samping') : null;
                $line[$idx['media_bersama_1']] = $row === 1 ? self::sampleUrl('bersama-1') : null;
                $line[$idx['media_bersama_2']] = $row === 1 ? self::sampleUrl('bersama-2') : null;
                $line[$idx['gambar_hasil_pemasangan_1']] = $row === 1 ? self::sampleUrl('pemasangan-1') : null;
                $rows[] = $line;
            }
        }

        return $rows;
    }

    private static function sampleUrl(string $slug): string
    {
        return 'https://media.333labs.tech/media-assets/contoh/'.$slug.'.webp';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $columns = ProductImportTemplateExport::columns();
        $last = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($columns));

        // Dua baris keterangan di atas, header di baris 3.
        $sheet->getStyle('A1:'.$last.'1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF1F497D']],
        ]);
        $sheet->getStyle('A2:'.$last.'2')->applyFromArray([
            'font' => ['italic' => true, 'size' => 10, 'color' => ['argb' => 'FF6B7280']],
        ]);

        // Header di baris 3 memakai warna grup yang sama dengan sheet Data.
        foreach ($columns as $i => $col) {
            $letter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
            $sheet->getStyle($letter.'3')->applyFromArray([
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['argb' => CatalogTemplateV2::GROUP_COLORS[$col['group']]],
                ],
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
                'alignment' => ['horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            ]);
        }

        $sheet->getRowDimension(3)->setRowHeight(30);
        CatalogTemplateV2Styler::applyWidths($sheet, ProductImportDataSheet::widths());
        $sheet->freezePane('A4');

        // Dropdown WAJIB ada di sheet Contoh juga, bukan hanya di sheet Data.
        // Sheet ini yang dibuka lebih dulu untuk melihat bentuk isian, jadi
        // kolom Kategori, Model, dan Sub Model di sini harus bisa dipilih.
        // Data contoh mulai baris 4 (baris 1-2 keterangan, baris 3 header).
        $letters = CatalogTemplateV2::lettersBySlug($columns);

        CatalogTemplateV2Styler::listValidation(
            $sheet,
            $letters['kategori_produk'],
            ProductImportDataSheet::categoryOptions(),
            self::lastExampleRow(),
            4
        );
        CatalogTemplateV2Styler::listValidation(
            $sheet,
            $letters['model_produk'],
            CatalogLabels::modelCodes(),
            self::lastExampleRow(),
            4
        );
        CatalogTemplateV2Styler::listValidation(
            $sheet,
            $letters['sub_model'],
            ProductImportDataSheet::subModelCodes(),
            self::lastExampleRow(),
            4
        );
    }

    /** Baris terakhir data contoh, dipakai sebagai batas rentang dropdown. */
    private static function lastExampleRow(): int
    {
        return 3 + count(self::sampleRows());
    }
}

/**
 * Sheet 3: Panduan. Kamus kolom, legenda warna grup, dan aturan pengisian.
 */
class ProductImportGuideSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $rows = [
            ['PANDUAN IMPORT PRODUK', 'Ragil Aluminium'],
            [],
            ['LEGENDA WARNA HEADER', '', ''],
        ];

        foreach (CatalogTemplateV2::GROUP_LABELS as $group => $label) {
            $rows[] = ['', $label, self::groupColumns($group)];
        }

        $rows[] = [];
        $rows[] = ['KAMUS KOLOM', 'ISI', 'CONTOH'];
        foreach (self::dictionary() as $line) {
            $rows[] = $line;
        }

        $rows[] = [];
        $rows[] = ['ATURAN PENTING', '', ''];
        foreach (self::rules() as $no => $rule) {
            $rows[] = [(string) ($no + 1), '', $rule];
        }

        return $rows;
    }

    public function title(): string
    {
        return 'Panduan';
    }

    private static function groupColumns(int $group): string
    {
        $letters = [];
        foreach (ProductImportTemplateExport::columns() as $i => $col) {
            if ($col['group'] === $group) {
                $letters[] = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
            }
        }

        return 'Kolom '.implode(', ', $letters);
    }

    /** @return list<list<string>> */
    private static function dictionary(): array
    {
        return [
            ['NO. ID', 'Nomor penanda grup. Baris dengan nomor sama dianggap satu produk. Isi angka 1, 2, 3, dan seterusnya.', '1'],
            ['Nama Produk', 'Nama tampil produk apa adanya. Nama ini yang dilihat pembeli dan TIDAK digenerate sistem.', 'Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing'],
            ['Deskripsi Produk', 'Deskripsi panjang produk.', 'Jendela aluminium dengan garansi 100%.'],
            ['Spesifikasi', 'Pasangan Nama: Nilai dipisah koma.', 'Bahan: Aluminium, Kusen: 3 inch'],
            ['Kategori Produk', 'Pilih dari daftar.', 'JENDELA'],
            ['Model Produk', 'Pilih dari daftar.', 'KACA_MATI'],
            ['Sub Model', 'Pilih dari daftar.', 'POLOS'],
            ['Nama Variasi 1', 'Nama sumbu variasi pertama.', 'Warna'],
            ['Opsi Variasi 1', 'Nilai opsi untuk baris ini.', 'Putih'],
            ['Gambar per Varian', 'URL foto yang menempel pada varian baris ini. Satu opsi cukup diisi sekali.', 'https://media.333labs.tech/...'],
            ['Nama Variasi 2', 'Nama sumbu variasi kedua. Boleh dikosongkan bila produk hanya punya satu variasi.', 'Kaca'],
            ['Opsi Variasi 2', 'Nilai opsi untuk baris ini.', 'Kaca Bening'],
            ['Harga', 'Harga jual varian ini. Angka polos tanpa titik dan tanpa Rp.', '1250000'],
            ['Stok', 'Jumlah stok. Angka biasa, atau format acak seperti random 1000-8000.', '10'],
            ['Berat (Kg)', 'Berat packing untuk ongkir. TIDAK tampil di storefront. Isi di baris pertama grup.', '12.5'],
            ['Tinggi (cm)', 'Tinggi packing untuk ongkir. TIDAK tampil di storefront.', '170'],
            ['Panjang (cm)', 'Panjang packing untuk ongkir. TIDAK tampil di storefront.', '60'],
            ['Lebar (cm)', 'Lebar packing untuk ongkir. TIDAK tampil di storefront.', '20'],
            ['Gambar 1 (utama)', 'URL foto utama katalog. WAJIB, tanpa ini produk tidak bisa aktif.', 'https://media.333labs.tech/...'],
            ['Gambar 2', 'URL foto katalog kedua.', 'https://media.333labs.tech/...'],
            ['Gambar 3', 'URL foto katalog ketiga.', 'https://media.333labs.tech/...'],
            ['Media Bersama 1', 'URL media yang dipakai semua varian produk.', 'https://media.333labs.tech/...'],
            ['Media Bersama 2', 'URL media bersama kedua.', 'https://media.333labs.tech/...'],
            ['Gambar Hasil Pemasangan 1', 'URL foto dokumentasi pemasangan.', 'https://media.333labs.tech/...'],
            ['Gambar Hasil Pemasangan 2', 'URL foto pemasangan kedua.', 'https://media.333labs.tech/...'],
        ];
    }

    /** @return list<string> */
    private static function rules(): array
    {
        return [
            'Satu baris = satu varian. Jumlah baris = jumlah varian produk itu.',
            'Kolom identitas (NO. ID, Nama Produk, Deskripsi, Spesifikasi, Kategori, Model, Sub Model) cukup diisi di baris pertama grup, sisanya boleh dikosongkan.',
            'Berat dan dimensi cukup diisi di baris pertama grup.',
            'Gambar 1 (utama) WAJIB ada supaya produk bisa aktif.',
            'Harga wajib lebih dari nol di setiap baris.',
            'URL harus URL publik yang bisa dibuka, bukan nama file atau kode objek.',
            'Baris dengan opsi variasi sama dalam satu grup dianggap duplikat dan ditolak.',
            'Sheet Contoh hanya ilustrasi. Hapus sebelum dikirim, atau biarkan karena tidak ikut diproses.',
            'Selalu tekan Periksa file sebelum Mulai Import.',
            'Berat dan dimensi hanya untuk perhitungan ongkir, tidak pernah tampil di storefront.',
        ];
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FFC20000']],
        ]);
        $sheet->getStyle('A3')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF1F497D']],
        ]);

        // Legenda warna: beri contoh warna pada kolom C.
        $row = 4;
        foreach (CatalogTemplateV2::GROUP_COLORS as $argb) {
            $sheet->getStyle('B'.$row)->applyFromArray([
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['argb' => $argb],
                ],
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
            ]);
            $row++;
        }

        $sheet->getColumnDimension('A')->setWidth(14);
        $sheet->getColumnDimension('B')->setWidth(30);
        $sheet->getColumnDimension('C')->setWidth(70);
        // Hanya baris yang benar-benar terpakai, supaya sheet tidak melar.
        $last = max($sheet->getHighestRow(), 1);
        $sheet->getStyle('C1:C'.$last)->getAlignment()->setWrapText(true);
    }
}
