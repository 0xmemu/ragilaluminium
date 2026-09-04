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
 *     lanjutan diwarisi).
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
            'name', 'description', 'product_category', 'product_model', 'design_variant',
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
        $headers = CatalogTemplateExport::dataHeaders();
        // 2 baris contoh nyata + penanda hapus (importer memproses sheet ini).
        $example = array_fill(0, count($headers), null);
        $at = fn (string $key) => array_search($key, $headers, true);
        $example[$at('name')] = 'CONTOH: hapus 2 baris contoh ini sebelum import';
        $example[$at('name')] = 'Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing Ornamen';
        $example[$at('description')] = 'Jendela jungkit aluminium ornamen. Gratis packing kayu, kirim seluruh Indonesia.';
        $example[$at('product_category')] = 'JENDELA';
        $example[$at('product_model')] = 'SWING';
        $example[$at('design_variant')] = 'ORNAMEN';
        $example[$at('variation_1_name')] = 'Warna';
        $example[$at('variation_1_option_1')] = 'Putih';
        $example[$at('variation_1_option_2')] = 'Hitam';
        $example[$at('variation_1_option_3')] = 'Coklat';
        $example[$at('variation_1_option_4')] = 'Serat Kayu';
        $example[$at('variation_2_name')] = 'Kaca';
        $example[$at('variation_2_option_1')] = 'Kaca Bening';
        $example[$at('variation_2_option_2')] = 'Kaca Riben';
        $example[$at('variation_2_option_3')] = 'Kaca Es';
        $example[$at('variantion_combination')] = 'Putih, Kaca Bening';
        $example[$at('price_variantion_combination')] = '200000';
        $example[$at('stock')] = '5';
        $example[$at('weight_kg')] = '1';
        $example[$at('height_cm')] = '100';
        $example[$at('width_cm')] = '200';
        $example[$at('depth_cm')] = '20';
        $example[$at('specifications')] = '[{"name":"Bahan","value":"Aluminium"}]';
        $example[$at('image_1')] = 'https://media.example.com/jendela-depan.webp';
        $example[$at('image_2')] = 'https://media.example.com/jendela-detail.webp';
        $example[$at('image_variation_1_option_1')] = 'https://media.example.com/warna-putih.webp';
        $example[$at('image_variation_1_option_2')] = 'https://media.example.com/warna-hitam.webp';
        $example[$at('image_variation_1_option_3')] = 'https://media.example.com/warna-coklat.webp';
        $example[$at('image_variation_1_option_4')] = 'https://media.example.com/warna-serat-kayu.webp';
        $example[$at('image_variation_2_option_1')] = 'https://media.example.com/kaca-bening.webp';
        $example[$at('image_variation_2_option_2')] = 'https://media.example.com/kaca-riben.webp';
        $example[$at('image_variation_2_option_3')] = 'https://media.example.com/kaca-es.webp';
        $example[$at('shared_media_1')] = 'https://media.example.com/video-produk.mp4';
        $example[$at('installation_image_1')] = 'https://media.example.com/pemasangan-1.webp';

        return [$headers, $example];
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
        $sheet->getStyle('A2:'.$lastCol.'2')->getFont()->getColor()->setArgb('FF8A4A00');
        $sheet->getStyle('A2:'.$lastCol.'2')->getFont()->setItalic(true);

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

        // Dropdown kategori/model/desain (nilai singkat, muat formula 250 char).
        $last = max($sheet->getHighestRow(), 200);
        $this->listValidation($sheet, 'C', ['JENDELA', 'PINTU', 'BOVEN'], $last);
        $this->listValidation($sheet, 'D', ['SWING', 'SLIDING', 'JUNGKIT', 'KACA MATI'], $last);
        $this->listValidation($sheet, 'E', ['POLOS', 'ORNAMEN', 'KOMBINASI'], $last);
        
    }

    protected function listValidation($sheet, string $col, array $values, int $lastRow): void
    {
        $formula = implode(',', $values);
        if (strlen($formula) > 250) {
            return;
        }
        $v = $sheet->getCell($col.'3')->getDataValidation();
        $v->setType(DataValidation::TYPE_LIST);
        $v->setAllowBlank(true);
        $v->setShowDropDown(true);
        $v->setFormula1('"'.$formula.'"');
        $sheet->setDataValidation($col.'3:'.$col.$lastRow, $v);
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
            ['Sheet Data adalah sheet yang diproses. Tabel di bawah hanya ilustrasi cara mengisi, tidak diproses.'],
            [],
            $headers,
        ];

        $ex = fn (array $overrides) => array_merge(
            array_fill(0, count($headers), null),
            $overrides,
        );
        $at = fn (string $key) => array_search($key, $headers, true);

        // Kombinasi 4 warna x 3 kaca = 12 baris, persis pola rancangan owner.
        $combos = [
            ['Putih', 'Kaca Bening', '200000'],
            ['Putih', 'Kaca Riben', '200000'],
            ['Putih', 'Kaca Es', '300000'],
            ['Hitam', 'Kaca Bening', '200000'],
            ['Hitam', 'Kaca Riben', '200000'],
            ['Hitam', 'Kaca Es', '300000'],
            ['Coklat', 'Kaca Bening', '200000'],
            ['Coklat', 'Kaca Riben', '200000'],
            ['Coklat', 'Kaca Es', '300000'],
            ['Serat Kayu', 'Kaca Bening', '250000'],
            ['Serat Kayu', 'Kaca Riben', '250000'],
            ['Serat Kayu', 'Kaca Es', '350000'],
        ];
        $first = true;
        foreach ($combos as [$warna, $kaca, $price]) {
            $row = $ex([
                $at('name') => 'Tinggi 170cm x Panjang 60cm Jendela Jungkit Satu Daun Swing Ornamen',
                $at('description') => 'Jendela jungkit aluminium ornamen. Gratis packing kayu, kirim seluruh Indonesia.',
                $at('product_category') => 'JENDELA',
                $at('product_model') => 'SWING',
                $at('design_variant') => 'ORNAMEN',
                $at('variation_1_name') => 'Warna',
                $at('variation_1_option_1') => 'Putih',
                $at('variation_1_option_2') => 'Hitam',
                $at('variation_1_option_3') => 'Coklat',
                $at('variation_1_option_4') => 'Serat Kayu',
                $at('variation_2_name') => 'Kaca',
                $at('variation_2_option_1') => 'Kaca Bening',
                $at('variation_2_option_2') => 'Kaca Riben',
                $at('variation_2_option_3') => 'Kaca Es',
                $at('variantion_combination') => $warna.', '.$kaca,
                $at('price_variantion_combination') => $price,
                $at('stock') => '5',
                $at('weight_kg') => '1',
                $at('height_cm') => '100',
                $at('width_cm') => '200',
                $at('depth_cm') => '20',
                $at('specifications') => '[{"name":"Bahan","value":"Aluminium"}]',
                $at('image_1') => $first ? 'https://media.example.com/jendela-depan.webp' : null,
                $at('image_variation_1_option_1') => $first ? 'https://media.example.com/warna-putih.webp' : null,
                $at('image_variation_1_option_2') => $first ? 'https://media.example.com/warna-hitam.webp' : null,
                $at('image_variation_2_option_1') => $first ? 'https://media.example.com/kaca-bening.webp' : null,
                $at('installation_image_1') => $first ? 'https://media.example.com/pemasangan-1.webp' : null,
            ]);
            $rows[] = $row;
            $first = false;
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
        $sheet->getStyle('A4:AK4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 9],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(30);
        $sheet->getStyle('A5:AK16')->applyFromArray([
            'font' => ['size' => 10],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        foreach (['A' => 34, 'O' => 22, 'P' => 18, 'B' => 40, 'V' => 34] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
        $sheet->freezePane('A5');
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
            ['name', 'WAJIB', 'Nama produk. Baris dengan name sama = varian dari produk yang sama; kolom identitas cukup diisi di baris pertama produk.'],
            ['description', 'WAJIB', 'Deskripsi produk (boleh multi-baris).'],
            ['product_category / product_model / design_variant', 'WAJIB', 'Pilih dari dropdown di sheet Data.'],
            ['variation_1_name', 'WAJIB BILA ADA VARIAN', 'Nama varian pertama, mis. "Warna". Tulis di baris pertama produk; baris lanjutan boleh kosong.'],
            ['variation_1_option_1..4', 'WAJIB BILA ADA VARIAN', 'Daftar pilihan varian pertama, mis. Putih, Hitam, Coklat, Serat Kayu. Tambah pilihan = copy kolom lalu ganti nomor (option_5, option_6, dst).'],
            ['variation_2_name / option_1..4', 'OPTIONAL', 'Varian kedua (mis. Kaca) dengan pilihannya. Pola sama.'],
            ['variantion_combination', 'WAJIB', 'Kombinasi yang dijual di baris ini, urut sesuai varian: "Putih, Kaca Bening". Pisahkan dengan koma.'],
            ['price_variantion_combination', 'WAJIB', 'Harga kombinasi ini (angka polos, tanpa titik ribuan).'],
            ['stock', 'OPTIONAL', 'Stok kombinasi ini. Kosong = pakai mode stok yang dipilih saat upload (file atau manual).'],
            ['weight_kg, height_cm, width_cm, depth_cm', 'WAJIB', 'Bobot & dimensi packing (angka > 0).'],
            ['specifications', 'OPTIONAL', 'Spesifikasi produk. Format "Nama: Nilai" dipisah baris, atau JSON [{"name":"Bahan","value":"Aluminium"}].'],
            ['image_1, image_2', 'OPTIONAL', 'Foto katalog umum produk (bukan per varian). Foto utama = image_1.'],
            ['image_variation_1_option_1..4', 'OPTIONAL', 'Foto per pilihan varian pertama: option_1 = Putih, beri foto putih di sini. Foto ini dipakai semua kombinasi yang memakai pilihan itu. Cukup isi sekali di baris pertama produk.'],
            ['image_variation_2_option_1..4', 'OPTIONAL', 'Sama, untuk varian kedua.'],
            ['shared_media_1, shared_media_2', 'OPTIONAL', 'Media bersama (foto/video tambahan) yang tampil di semua kombinasi.'],
            ['installation_image_1..2', 'OPTIONAL', 'Foto hasil pemasangan. Tambah pemasangan lain = copy kolom, ganti nomor (installation_image_3, dst).'],
            [],
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
