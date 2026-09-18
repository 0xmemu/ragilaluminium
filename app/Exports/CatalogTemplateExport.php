<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template Import Katalog (XLSX) - desain owner 2026-09-05.
 *
 * 3 sheet: Data (diproses) / Contoh (ilustrasi) / Panduan.
 * 1 baris di sheet Data = 1 KOMBINASI varian jadi (mis. "Putih, Kaca Bening").
 *
 * Pola kolom (default 2 varian name, masing-masing 4 option):
 *   - Identitas produk: name, description, product_category, product_model,
 *     design_variant, specifications (cukup di baris pertama produk; baris
 *     lanjutan diwarisi). Format specifications: "Nama: Nilai" dipisah koma,
 *     contoh: "Bahan: Aluminium, Kaca: Tempered, Kusen: 4 inch".
 *   - Definisi varian: variation_1_name + variation_1_option_1..4,
 *     variation_2_name + variation_2_option_1..4 (tambah varian = copy kolom).
 *   - Per kombinasi: variantion_combination (daftar opsi dipilih, urut sesuai
 *     varian), price_variantion_combination, stock (opsional).
 *   - Gambar: image_1..2 (katalog umum produk),
 *     image_variation_1_option_1..4, image_variation_2_option_1..4 (per opsi),
 *     shared_media_1..2 (media bersama, boleh video),
 *     installation_image_1..2 (default 2, tambah = copy kolom).
 *
 * Kompatibilitas ejaan: importer menerima "variantion*" dan "variation*".
 * File lama (variation_N_option + image_1..9 + sheet Varian) tetap diproses.
 */
class CatalogTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        // Urutan penting: Data HARUS sheet pertama (dibaca import engine).
        return [
            new CatalogDataSheet(),
            new CatalogExampleSheet(),
            new CatalogGuideSheet(),
        ];
    }

    /** Header sheet Data (31 kolom default). */
    public static function dataHeaders(): array
    {
        $cols = [
            'id_key', 'name', 'description', 'product_category', 'product_model', 'design_variant',
            'variation_1_name', 'variation_1_option_1', 'variation_1_option_2', 'variation_1_option_3', 'variation_1_option_4',
            'variation_2_name', 'variation_2_option_1', 'variation_2_option_2', 'variation_2_option_3', 'variation_2_option_4',
            'variantion_combination', 'price_variantion_combination', 'stock',
            'weight_kg', 'height_cm', 'width_cm', 'depth_cm', 'specifications',
            'image_1', 'image_2',
            'image_variation_1_option_1', 'image_variation_1_option_2', 'image_variation_1_option_3', 'image_variation_1_option_4',
            'image_variation_2_option_1', 'image_variation_2_option_2', 'image_variation_2_option_3', 'image_variation_2_option_4',
            'shared_media_1', 'shared_media_2',
            'installation_image_1', 'installation_image_2',
        ];

        return $cols;
    }
}

// ------ 1. DATA (sheet pertama, diproses importer) ------

class CatalogDataSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        // Sheet utama murni data: header saja, tanpa baris contoh, tanpa
        // styling khusus (contoh ada di sheet Contoh).
        return [CatalogTemplateExport::dataHeaders()];
    }

    public function title(): string
    {
        return 'Data';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $lastCol = 'AK';
        $sheet->getStyle('A1:'.$lastCol.'1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);

        foreach (['A' => 10, 'B' => 34, 'C' => 40, 'D' => 17, 'E' => 13, 'F' => 13,
            'F' => 14, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 14,
            'K' => 14, 'L' => 14, 'M' => 14, 'N' => 14,
            'O' => 22, 'P' => 18, 'Q' => 9,
            'R' => 10, 'S' => 10, 'T' => 10, 'U' => 10, 'V' => 34,
            'W' => 40, 'X' => 40,
            'Y' => 40, 'Z' => 40, 'AA' => 40, 'AB' => 40,
            'AC' => 40, 'AD' => 40, 'AE' => 40, 'AF' => 40,
            'AG' => 40, 'AH' => 40,
            'AI' => 40, 'AJ' => 40,
        ] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }

        // Dropdown kategori/model/desain pada kolom yang benar (D, E, F):
        // Kolom C = description (teks bebas, tanpa dropdown)
        // Kolom D = product_category
        // Kolom E = product_model (termasuk model daun spesifik)
        // Kolom F = design_variant (sub model)
        $last = max($sheet->getHighestRow(), 200);
        $this->listValidation($sheet, 'D', ['JENDELA', 'PINTU', 'BOVEN'], $last);
        $models = [
            'JUNGKIT_1_DAUN', 'JUNGKIT_2_DAUN', 'JUNGKIT_3_DAUN',
            'SLIDING_2_DAUN', 'SWING_1_DAUN', 'SWING_2_DAUN', 'SWING_3_DAUN',
            'KACA_MATI', 'ZIGZAG',
        ];
        $this->listValidation($sheet, 'E', $models, $last);
        // Kolom F = sub model. Daftar diambil dari sub model yang benar-benar
        // ada, supaya model tanpa sub model tidak dipaksa memilih POLOS.
        $designCodes = \App\Models\SubModel::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->pluck('code')
            ->unique()
            ->values()
            ->all();
        $this->listValidation($sheet, 'F', $designCodes, $last);
        
    }

    protected function listValidation($sheet, string $col, array $values, int $lastRow): void
    {
        $formula = implode(',', $values);
        if (strlen($formula) > 250) {
            return;
        }
        $v = $sheet->getCell($col.'2')->getDataValidation();
        $v->setType(DataValidation::TYPE_LIST);
        $v->setAllowBlank(true);
        $v->setShowDropDown(true);
        $v->setFormula1('"'.$formula.'"');
        $sheet->setDataValidation($col.'2:'.$col.$lastRow, $v);
    }
}

// ------ 2. CONTOH (ilustrasi, tidak diproses) ------

class CatalogExampleSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $headers = CatalogTemplateExport::dataHeaders();
        $rows = [
            ['CONTOH ISI DATA IMPORT KATALOG'],
            ['Copy pola ini ke sheet Data. 1 baris = 1 kombinasi varian jadi. Kolom identitas & definisi varian cukup di baris pertama produk.'],
            $headers,
        ];

        $at = fn (string $key) => array_search($key, $headers, true);

        // 1 produk, 12 kombinasi (4 warna x 3 kaca). Baris pertama lengkap;
        // baris lanjutan hanya kombinasi + harga + stok (identitas diwarisi).
        $combos = [
            ['Putih', 'Kaca Bening', '200000', '5'],
            ['Putih', 'Kaca Riben', '200000', '5'],
            ['Putih', 'Kaca Es', '300000', '3'],
            ['Hitam', 'Kaca Bening', '200000', '5'],
            ['Hitam', 'Kaca Riben', '200000', '5'],
            ['Hitam', 'Kaca Es', '300000', '3'],
            ['Coklat', 'Kaca Bening', '200000', '5'],
            ['Coklat', 'Kaca Riben', '200000', '5'],
            ['Coklat', 'Kaca Es', '300000', '3'],
            ['Serat Kayu', 'Kaca Bening', '250000', '2'],
            ['Serat Kayu', 'Kaca Riben', '250000', '2'],
            ['Serat Kayu', 'Kaca Es', '350000', '2'],
        ];
        foreach ($combos as $i => [$warna, $kaca, $price, $stock]) {
            $row = array_fill(0, count($headers), null);
            $row[$at('id_key')] = 1;
            if ($i === 0) {
                $row[$at('name')] = 'Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing Ornamen';
                $row[$at('description')] = 'Jendela jungkit aluminium ornamen. Gratis packing kayu, kirim seluruh Indonesia.';
                $row[$at('product_category')] = 'JENDELA';
                $row[$at('product_model')] = 'SWING';
                $row[$at('design_variant')] = 'ORNAMEN';
                $row[$at('variation_1_name')] = 'Warna';
                $row[$at('variation_1_option_1')] = 'Putih';
                $row[$at('variation_1_option_2')] = 'Hitam';
                $row[$at('variation_1_option_3')] = 'Coklat';
                $row[$at('variation_1_option_4')] = 'Serat Kayu';
                $row[$at('variation_2_name')] = 'Kaca';
                $row[$at('variation_2_option_1')] = 'Kaca Bening';
                $row[$at('variation_2_option_2')] = 'Kaca Riben';
                $row[$at('variation_2_option_3')] = 'Kaca Es';
                $row[$at('weight_kg')] = '1';
                $row[$at('height_cm')] = '100';
                $row[$at('width_cm')] = '200';
                $row[$at('depth_cm')] = '20';
                $row[$at('specifications')] = 'Bahan: Aluminium, Kaca: Tempered, Kusen: 4 inch';
                $row[$at('image_1')] = 'https://media.333labs.tech/.../jendela-depan.webp';
                $row[$at('image_variation_1_option_1')] = 'https://media.333labs.tech/.../warna-putih.webp';
                $row[$at('image_variation_1_option_2')] = 'https://media.333labs.tech/.../warna-hitam.webp';
                $row[$at('image_variation_1_option_3')] = 'https://media.333labs.tech/.../warna-coklat.webp';
                $row[$at('image_variation_1_option_4')] = 'https://media.333labs.tech/.../warna-serat-kayu.webp';
                $row[$at('image_variation_2_option_1')] = 'https://media.333labs.tech/.../kaca-bening.webp';
                $row[$at('image_variation_2_option_2')] = 'https://media.333labs.tech/.../kaca-riben.webp';
                $row[$at('image_variation_2_option_3')] = 'https://media.333labs.tech/.../kaca-es.webp';
                $row[$at('installation_image_1')] = 'https://media.333labs.tech/.../pemasangan-1.webp';
            }
            $row[$at('variantion_combination')] = $warna.', '.$kaca;
            $row[$at('price_variantion_combination')] = $price;
            $row[$at('stock')] = $stock;
            $rows[] = $row;
        }

        return $rows;
    }

    public function title(): string
    {
        return 'Contoh';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13);
        $sheet->getStyle('A2')->getFont()->setSize(10)->getColor()->setArgb('FF666666');
        $sheet->getStyle('A3:AK3')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 9],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
        ]);
        $sheet->getRowDimension(3)->setRowHeight(30);
        $sheet->getStyle('A4:AK15')->applyFromArray([
            'font' => ['size' => 10],
            'alignment' => ['wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        foreach (['A' => 34, 'B' => 40, 'C' => 17, 'D' => 13, 'E' => 13,
            'F' => 14, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 14,
            'K' => 14, 'L' => 14, 'M' => 14, 'N' => 14,
            'O' => 22, 'P' => 18, 'Q' => 9,
            'R' => 10, 'S' => 10, 'T' => 10, 'U' => 10, 'V' => 34,
            'W' => 40, 'X' => 40,
            'Y' => 40, 'Z' => 40, 'AA' => 40, 'AB' => 40,
            'AC' => 40, 'AD' => 40, 'AE' => 40, 'AF' => 40,
            'AG' => 40, 'AH' => 40,
            'AI' => 40, 'AJ' => 40,
        ] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
        $sheet->freezePane('C4');
    }
}

// ------ 3. PANDUAN ------

class CatalogGuideSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        return [
            ['PANDUAN IMPORT KATALOG', 'Ragil Aluminium'],
            ['1 baris di sheet Data = 1 kombinasi varian jadi yang dijual (mis. "Putih, Kaca Bening").'],
            [],
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['id_key', 'WAJIB', 'ID grup produk: penanda baris-baris mana yang satu produk. Semua baris dengan id_key sama = satu produk. Isi di SEMUA baris grup (disarankan). Boleh angka atau teks (1, 2, PROD-A). Hanya penanda sesi import; tidak disimpan, tidak memengaruhi SKU.'],
            ['name', 'WAJIB', 'Nama produk. Wajib SAMA di semua baris dengan id_key sama; cukup diisi di baris pertama grup.'],
            ['description', 'WAJIB', 'Deskripsi produk (boleh multi-baris).'],
            ['product_category / product_model', 'WAJIB', 'Pilih dari dropdown di sheet Data.'],
            ['design_variant', 'OPSIONAL', 'Sub model produk. Pilih dari dropdown, atau ketik kode baru bila sub model belum terdaftar (mis. ZIGZAG dengan ORNAMEN). Kosongkan bila produk berdiri sendiri tanpa sub model, seperti Boven Zigzag. Kode disimpan dalam huruf kapital.'],
            ['variation_1_name', 'WAJIB BILA ADA VARIAN', 'Nama varian pertama, mis. "Warna". Tulis di baris pertama produk; baris lanjutan boleh kosong.'],
            ['variation_1_option_1..4', 'WAJIB BILA ADA VARIAN', 'Daftar pilihan varian pertama, mis. Putih, Hitam, Coklat, Serat Kayu. Tambah pilihan = copy kolom lalu ganti nomor (option_5, option_6, dst).'],
            ['variation_2_name / option_1..4', 'OPTIONAL', 'Varian kedua (mis. Kaca) dengan pilihannya. Pola sama.'],
            ['variantion_combination', 'WAJIB', 'Kombinasi yang dijual di baris ini, urut sesuai varian: "Putih, Kaca Bening". Pisahkan dengan koma.'],
            ['price_variantion_combination', 'WAJIB', 'Harga kombinasi ini (angka polos, tanpa titik ribuan).'],
            ['stock', 'OPTIONAL', 'Stok kombinasi ini. Kosong = pakai mode stok yang dipilih saat upload (file atau manual).'],
            ['weight_kg, height_cm, width_cm, depth_cm', 'WAJIB', 'Berat & dimensi packing: height_cm = TINGGI, width_cm = PANJANG, depth_cm = LEBAR (sama dengan form admin Produk; nama kolom mengikuti sistem). Angka > 0.'],
            ['specifications', 'OPSIONAL', 'Spesifikasi produk milik PRODUK (bukan per kombinasi). Format: Nama: Nilai, antar spesifikasi dipisah KOMA. Contoh: Bahan: Aluminium, Kaca: Tempered, Kusen: 4 inch. Titik koma dan baris baru juga diterima. Koma di dalam nilai aman ditulis apa adanya (mis. "Finishing: Powder coating (pilihan: hitam, putih, cokelat)") karena koma hanya memulai spesifikasi baru bila diikuti "Nama: Nilai". Nilai di baris mana pun dalam grup akan tersimpan SEKALI untuk produk, tidak berulang. Kosong = sistem mengisi dari template spesifikasi per sub model. Admin bisa menambah spesifikasi lain kapan pun dari form edit produk.'],
            ['image_1, image_2', 'OPTIONAL', 'Foto katalog umum produk (bukan per varian). Foto utama = image_1.'],
            ['image_variation_1_option_1..4', 'OPTIONAL', 'Foto per pilihan varian pertama: option_1 = Putih, beri foto putih di sini. Foto ini dipakai semua kombinasi yang memakai pilihan itu. Cukup isi sekali di baris pertama produk.'],
            ['image_variation_2_option_1..4', 'OPTIONAL', 'Sama, untuk varian kedua.'],
            ['shared_media_1, shared_media_2', 'OPTIONAL', 'Media bersama (foto/video tambahan) yang tampil di semua kombinasi. Urutan tampil: setelah gambar utama, gambar umum image_2..9, dan gambar per opsi varian.'],
            ['installation_image_1..2', 'OPTIONAL', 'Foto hasil pemasangan. Tambah pemasangan lain = copy kolom, ganti nomor (installation_image_3, dst).'],
            [],
            ['VERIFIKASI OTOMATIS', '', 'File diverifikasi SEBELUM dieksekusi. Satu saja pelanggaran = tidak ada produk yang diimpor. Pelanggaran: id_key muncul kembali setelah digantikan (baris grup harus berurutan); satu id_key memuat nama berbeda; kombinasi opsi duplikat dalam satu id_key; daftar opsi berbeda antar baris satu id_key; harga kosong/nol pada baris kombinasi.'],
            ['ATURAN PENTING', '', 'Kolom lain diabaikan. Produk dikelompokkan dari kolom name. SKU dibuat otomatis. Sel kosong pada kolom opsional = tidak diubah. Batas 50.000 baris per file.'],
            ['FILE LAMA', '', 'File dengan format lama (variation_1_option, image_1..9, installation_image_1..9, atau sheet Varian) tetap bisa diproses.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13);
        $sheet->getStyle('A2')->getFont()->setSize(10)->getColor()->setArgb('FF666666');
        $sheet->getStyle('A4:C4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);
        $sheet->getStyle('A5:C'.$sheet->getHighestRow())->applyFromArray([
            'font' => ['size' => 10],
            'alignment' => ['wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getColumnDimension('A')->setWidth(42);
        $sheet->getColumnDimension('B')->setWidth(22);
        $sheet->getColumnDimension('C')->setWidth(90);
        $sheet->freezePane('A5');
    }
}
