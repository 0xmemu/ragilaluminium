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
 * Template import katalog (XLSX) - skema DUA SHEET ala marketplace.
 *
 *   1. "Varian"    - definisi opsi + gambar per opsi (1 baris = 1 opsi).
 *                    Default: 2 varian name, masing-masing 4 opsi (baris kosong
 *                    disiapkan); tambah varian = tambah baris, tambah opsi =
 *                    tambah baris. Tidak ada batas kolom.
 *   2. "Kombinasi" - harga & stok per kombinasi (1 baris = 1 varian jadi).
 *                    Kolom option_1..N mengikuti urutan varian di sheet Varian;
 *                    default 2 kolom, tambah varian ke-3 = tambah kolom option_3.
 *   3. "Panduan"   - cara isi + aturan.
 *
 * Kolom identitas produk (name, description, kategori, model, design_variant,
 * specifications) ada di sheet Kombinasi baris pertama tiap produk.
 *
 * Header tetap snake_case karena importer membaca by key (WithHeadingRow).
 */
class CatalogTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        // Urutan penting: Kombinasi HARUS sheet pertama karena Excel::import
        // (Maatwebsite) membaca sheet aktif pertama sebagai data utama.
        // Sheet Varian dibaca terpisah via VariantSheetParser.
        return [
            new CatalogCombinationSheet(),
            new CatalogVariantSheet(),
            new CatalogTemplateGuideSheet(),
        ];
    }
}

/**
 * Definisi kolom identitas produk di sheet Kombinasi (urutan fix).
 */
class CatalogTemplateColumns
{
    public const IDENTITY = [
        'name', 'description', 'product_category', 'product_model', 'design_variant', 'specifications',
    ];
}

// ------ 1. VARIAN (opsi + gambar per opsi) ------

class CatalogVariantSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $rows = [
            ['varian_name', 'option', 'image_url', 'installation_image_url'],
        ];

        // 2 varian default x 4 opsi (baris kosong siap isi); admin bebas
        // menambah/menghapus baris - importer membaca baris berisi saja.
        $rows[] = ['Warna', 'Hitam', null, null];
        $rows[] = [null, 'Putih', null, null];
        $rows[] = [null, 'Silver', null, null];
        $rows[] = [null, null, null, null];
        $rows[] = ['Kaca', 'Bening', null, null];
        $rows[] = [null, 'Buram', null, null];
        $rows[] = [null, null, null, null];
        $rows[] = [null, null, null, null];

        return $rows;
    }

    public function title(): string
    {
        return 'Varian';
    }

    public function registerEvents(): array
    {
        return [AfterSheet::class => fn (AfterSheet $event) => $this->afterSheet($event)];
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $sheet->getStyle('A1:D1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);
        foreach (['A' => 16, 'B' => 20, 'C' => 48, 'D' => 48] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
        $sheet->freezePane('A2');
        $sheet->getStyle('A2:D'.max($sheet->getHighestRow(), 200))->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
    }
}

// ------ 2. KOMBINASI (harga + stok per varian jadi) ------

class CatalogCombinationSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $rows = [
            [
                'name', 'description', 'product_category', 'product_model', 'design_variant', 'specifications',
                'option_1', 'option_2', 'option_3', 'option_4', 'option_5',
                'price', 'stock', 'weight_kg', 'height_cm', 'width_cm', 'depth_cm',
                'installation_image_url',
            ],
        ];

        // 2 contoh kombinasi varian 1 (option_1) x varian 2 (option_2).
        $rows[] = [
            'Jendela Aluminium Jungkit Ornamen 200x180',
            'Jendela jungkit aluminium dengan ornamen, kaca bening.',
            'JENDELA', 'JUNGKIT', 'ORNEMEN',
            '[{"name":"Bahan","value":"Aluminium"}]',
            'Hitam', 'Bening', null, null, null,
            '10170000', '3', '45', '200', '180', '10',
            null,
        ];
        $rows[] = [
            null, null, null, null, null, null,
            'Hitam', 'Buram', null, null, null,
            '10290000', '2', '45', '200', '180', '10',
            null,
        ];
        $rows[] = [
            null, null, null, null, null, null,
            'Putih', 'Bening', null, null, null,
            '10250000', '4', '45', '200', '180', '10',
            null,
        ];

        return $rows;
    }

    public function title(): string
    {
        return 'Kombinasi';
    }

    public function registerEvents(): array
    {
        return [AfterSheet::class => fn (AfterSheet $event) => $this->afterSheet($event)];
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $sheet->getStyle('A1:R1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);
        foreach (['A' => 40, 'B' => 40, 'C' => 16, 'D' => 14, 'E' => 14, 'F' => 40,
            'G' => 14, 'H' => 14, 'I' => 14, 'J' => 14, 'K' => 14,
            'L' => 14, 'M' => 10, 'N' => 10, 'O' => 10, 'P' => 10, 'Q' => 10, 'R' => 10,
        ] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
        $sheet->freezePane('C2');
        $last = max($sheet->getHighestRow(), 200);
        $sheet->getStyle('A2:R'.$last)->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $this->addListValidation($sheet, 'C', \App\Support\CatalogLabels::categoryCodes(), $last);
        $this->addListValidation($sheet, 'D', \App\Support\CatalogLabels::modelCodes(), $last);
        $this->addListValidation($sheet, 'E', \App\Support\CatalogLabels::designCodes(), $last);
    }

    protected function addListValidation($sheet, string $col, array $values, int $lastRow): void
    {
        $values = array_values(array_unique(array_filter($values)));
        if ($values === []) {
            return;
        }
        $formula = implode(',', $values);
        if (strlen($formula) > 250) {
            return;
        }
        $range = $col.'2:'.$col.$lastRow;
        $v = $sheet->getCell($col.'2')->getDataValidation();
        $v->setType(DataValidation::TYPE_LIST);
        $v->setAllowBlank(true);
        $v->setShowDropDown(true);
        $v->setFormula1('"'.$formula.'"');
        $v->setError('Nilai tidak ada dalam daftar. Pilih dari dropdown.');
        $v->setErrorTitle('Pilihan tidak valid');
        $sheet->setDataValidation($range, $v);
    }
}

// ------ 3. PANDUAN ------

class CatalogTemplateGuideSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function __construct()
    {
    }

    public function array(): array
    {
        return [
            ['PANDUAN IMPORT KATALOG', 'Ragil Aluminium'],
            [''],
            ['Sheet "Varian"', 'Definisi opsi varian + gambar per opsi. 1 baris = 1 opsi.'],
            ['', 'varian_name ditulis di baris opsi pertama varian itu; baris opsi lanjutan cukup kosong di kolom varian_name.'],
            ['', 'image_url wajib untuk setiap opsi; gambar ini menjadi gambar semua varian yang memakai opsi tersebut.'],
            ['', 'installation_image_url (opsional) = foto hasil pemasangan untuk opsi tersebut.'],
            ['', 'Tambah varian = tambah nama varian baru. Tambah opsi = tambah baris. Tanpa batas kolom.'],
            [''],
            ['Sheet "Kombinasi"', 'Harga & stok per varian jadi. 1 baris = 1 kombinasi opsi.'],
            ['', 'option_1 = nilai varian ke-1, option_2 = nilai varian ke-2, urut mengikuti urutan varian di sheet Varian.'],
            ['', 'Kolom identitas produk (name s.d. specifications) cukup di baris pertama produk; baris lanjutan boleh kosong.'],
            ['', 'price dan stock WAJIB di setiap baris kombinasi (harga per varian jadi, bukan per produk).'],
            ['', 'Tambah varian ke-3 = tambah kolom option_3 (copy kolom option_2 lalu ganti header). Maksimal 5 varian name (batas database).'],
            ['', 'installation_image_url di sheet ini = foto hasil pemasangan umum produk (opsional).'],
            [''],
            ['Back-compat', 'File lama dengan kolom variation_1..5_name/option, image_1..9, installation_image_1..9 tetap bisa diproses.'],
            [''],
            ['Batas', '50.000 baris per file. Sel kosong pada update media = tidak diubah. Import tidak pernah menghapus foto.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }

    public function registerEvents(): array
    {
        return [AfterSheet::class => fn (AfterSheet $event) => $this->afterSheet($event)];
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $sheet->getStyle('A1:B1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
        ]);
        $sheet->getColumnDimension('A')->setWidth(24);
        $sheet->getColumnDimension('B')->setWidth(110);
        foreach ([3, 9] as $row) {
            $sheet->getStyle('A'.$row.':B'.$row)->getFont()->setBold(true);
        }
    }
}
