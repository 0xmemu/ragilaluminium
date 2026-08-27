<?php

namespace App\Exports;

use App\Support\CatalogLabels;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template import katalog (XLSX): 3 sheet Data / Contoh / Panduan.
 * Header sengaja tetap snake_case di sheet Data karena processor import
 * membaca by key (WithHeadingRow). Human-friendly dicapai via dropdown
 * enum, Panduan, dan Contoh + styling DS v2.
 */
class CatalogTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new CatalogTemplateDataSheet(),
            new CatalogTemplateExampleSheet(),
            new CatalogTemplateGuideSheet(),
        ];
    }
}

// ------ DATA (sheet pertama, dibaca processor) ------

class CatalogTemplateDataSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [[
            'parent_sku', 'variant_sku', 'name', 'description', 'product_category',
            'product_model', 'design_variant', 'variation_1_name', 'variation_1_option',
            'variation_2_name', 'variation_2_option', 'price', 'stock', 'weight_kg',
            'height_cm', 'width_cm', 'depth_cm', 'specifications', 'status',
        ]];
    }

    public function title(): string
    {
        return 'Data';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $this->styleHeader($sheet, 'A', 'S');
        $this->setColumnWidths($sheet);
        $sheet->freezePane('A2');

        $lastRow = max($sheet->getHighestRow(), 200);
        $this->addListValidation($sheet, 'E', CatalogLabels::categoryCodes(), $lastRow);
        $this->addListValidation($sheet, 'F', CatalogLabels::modelCodes(), $lastRow);
        $this->addListValidation($sheet, 'G', CatalogLabels::designCodes(), $lastRow);
        $this->addListValidation($sheet, 'S', ['draft', 'archived', 'active'], $lastRow);
    }

    private function styleHeader($sheet, string $from, string $to): void
    {
        $sheet->getStyle($from.'1:'.$to.'1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);
    }

    private function setColumnWidths($sheet): void
    {
        $w = [
            'A' => 16, 'B' => 20, 'C' => 40, 'D' => 40, 'E' => 14,
            'F' => 12, 'G' => 12, 'H' => 12, 'I' => 12, 'J' => 12,
            'K' => 12, 'L' => 14, 'M' => 10, 'N' => 10, 'O' => 10,
            'P' => 10, 'Q' => 10, 'R' => 34, 'S' => 10,
        ];
        foreach ($w as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
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
        $v->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
        $v->setAllowBlank(true);
        $v->setShowDropDown(true);
        $v->setFormula1('"'.$formula.'"');
        $v->setError('Nilai tidak ada dalam daftar. Pilih dari dropdown.');
        $v->setErrorTitle('Pilihan tidak valid');
        $sheet->setDataValidation($range, $v);
    }
}

// ------ CONTOH ------

class CatalogTemplateExampleSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['CONTOH ISI DATA IMPORT KATALOG', 'Ragil Aluminium'],
            ['Isi baris produk baru di sheet Data. Data di bawah hanya contoh ilustrasi, tidak akan diproses.'],
            [],
            [
                'parent_sku', 'variant_sku', 'name', 'description', 'product_category',
                'product_model', 'design_variant', 'variation_1_name', 'variation_1_option',
                'variation_2_name', 'variation_2_option', 'price', 'stock', 'weight_kg',
                'height_cm', 'width_cm', 'depth_cm', 'specifications', 'status',
            ],
            [
                'RGL-JNG-JKT-1', 'RGL-JNG-JKT-1-H', 'Jendela Aluminium Jungkit Ornamen 200x180',
                'Jendela jungkit aluminium dengan ornamen, kaca bening.', 'JENDELA',
                'JUNGKIT', 'ORNEMEN', 'Warna', 'Hitam', 'Kaca', 'Bening',
                '10170000', '3', '45', '200', '180', '10',
                '[{"name":"Bahan","value":"Aluminium"}]', 'draft',
            ],
            [
                'RGL-PNT-SLD-1', 'RGL-PNT-SLD-1-P', 'Pintu Aluminium Sliding 100x220',
                'Pintu sliding aluminium standar, kaca buram.', 'PINTU',
                'SLIDING', 'POLOS', 'Warna', 'Silver', 'Kaca', 'Buram',
                '5400000', '2', '30', '100', '220', '8',
                '[{"name":"Bahan","value":"Aluminium"}]', 'draft',
            ],
            [
                'RGL-PNT-SLD-2', 'RGL-PNT-SLD-2-P', 'Pintu Aluminium Sliding 120x230',
                'Pintu sliding aluminium, kaca bening.', 'PINTU',
                'SLIDING', 'POLOS', 'Warna', 'Hitam', 'Kaca', 'Bening',
                '6200000', '5', '35', '120', '230', '8',
                '[{"name":"Bahan","value":"Aluminium"}]', 'draft',
            ],
            [],
            ['^ Contoh format. Hapus baris ini sebelum mengisi data asli.'],
        ];
    }

    public function title(): string
    {
        return 'Contoh';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        // Row 1: title
        $sheet->mergeCells('A1:S1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        // Row 2: subtitle
        $sheet->mergeCells('A2:S2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT],
        ]);

        // Row 4: header
        $sheet->getStyle('A4:S4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(26);

        // Rows 5-7: example data with zebra
        $cols = range('A', 'S');
        $zebra = [false, true, false];
        $colors = ['FF333333', 'FF333333'];
        $zebraFills = ['FFFFFFFF', 'FFF7F8F7'];
        for ($i = 0; $i < 3; $i++) {
            $row = 5 + $i;
            $fill = $zebraFills[$i % 2];
            $sheet->getStyle('A'.$row.':S'.$row)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
            ]);
            if ($fill !== 'FFFFFFFF') {
                $sheet->getStyle('A'.$row.':S'.$row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color($fill));
            }
        }

        // Row 9: note
        $sheet->mergeCells('A9:S9');
        $sheet->getStyle('A9')->applyFromArray([
            'font' => ['size' => 9, 'color' => ['argb' => 'FF666666'], 'italic' => true],
        ]);

        // Freeze below header
        $sheet->freezePane('A5');

        // Column widths
        $w = [
            'A' => 16, 'B' => 20, 'C' => 40, 'D' => 40, 'E' => 14,
            'F' => 12, 'G' => 12, 'H' => 12, 'I' => 12, 'J' => 12,
            'K' => 12, 'L' => 14, 'M' => 10, 'N' => 10, 'O' => 10,
            'P' => 10, 'Q' => 10, 'R' => 34, 'S' => 10,
        ];
        foreach ($w as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
    }
}

// ------ PANDUAN ------

class CatalogTemplateGuideSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['PANDUAN IMPORT KATALOG', 'Ragil Aluminium'],
            ['Cara mengisi file import dengan benar.'],
            [],
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['parent_sku', 'WAJIB', 'Kode produk utama. Harus unik. Baris dengan parent_sku sama akan memperbarui produk yang sudah ada.'],
            ['variant_sku', 'OPTIONAL', 'Kode varian. Kosongkan bila produk tidak punya varian. Wajib bila satu parent memiliki banyak pilihan (warna/ukuran/kaca).'],
            ['name', 'WAJIB', 'Nama produk yang tampil di toko.'],
            ['description', 'OPTIONAL', 'Deskripsi produk.'],
            ['product_category', 'WAJIB', 'Kategori. Pilih dari dropdown. Kategori tak dikenal ditandai untuk tinjauan admin.'],
            ['product_model', 'WAJIB', 'Model. Pilih dari dropdown.'],
            ['design_variant', 'WAJIB', 'Desain. Pilih dari dropdown.'],
            ['variation_1_name', 'OPTIONAL', 'Nama variasi pertama, mis. "Warna".'],
            ['variation_1_option', 'OPTIONAL', 'Nilai variasi pertama, mis. "Hitam".'],
            ['variation_2_name', 'OPTIONAL', 'Nama variasi kedua, mis. "Kaca".'],
            ['variation_2_option', 'OPTIONAL', 'Nilai variasi kedua, mis. "Bening".'],
            ['price', 'WAJIB', 'Harga varian (Rupiah, angka, tanpa titik ribuan).'],
            ['stock', 'WAJIB', 'Stok varian (bilangan bulat >= 0).'],
            ['weight_kg', 'OPTIONAL', 'Berat dalam kilogram (desimal titik).'],
            ['height_cm', 'OPTIONAL', 'Tinggi dalam cm.'],
            ['width_cm', 'OPTIONAL', 'Lebar dalam cm.'],
            ['depth_cm', 'OPTIONAL', 'Kedalaman dalam cm.'],
            ['specifications', 'OPTIONAL', 'Spesifikasi dalam format JSON.'],
            ['status', 'WAJIB', 'Status awal. Pilih dari dropdown: draft, archived, active.'],
            ['CATATAN', '', 'Isi satu produk per baris di sheet Data. Jangan ubah nama kolom (snake_case). Gunakan sheet Contoh sebagai rujukan.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        // Row 1: title
        $sheet->mergeCells('A1:C1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        // Row 2: subtitle
        $sheet->mergeCells('A2:C2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
        ]);

        // Row 4: header
        $sheet->getStyle('A4:C4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(26);

        // Content rows (5..last): borders, wrap text
        $last = $sheet->getHighestRow();
        $sheet->getStyle('A5:C'.$last)->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
            'alignment' => ['wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);

        // Color-code WAJIB (green) / OPTIONAL (blue) / CATATAN (info)
        for ($r = 5; $r <= $last; $r++) {
            $v = $sheet->getCell('B'.$r)->getValue();
            if ($v === 'WAJIB') {
                $sheet->getStyle('B'.$r)->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['argb' => 'FF2B734E']],
                ]);
            } elseif (is_string($v) && strpos($v, 'OPTIONAL') === 0) {
                $sheet->getStyle('B'.$r)->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['argb' => 'FF2C6D9B']],
                ]);
            }
        }

        // CATATAN row: info fill
        $noteRow = $last;
        $sheet->getStyle('A'.$noteRow.':C'.$noteRow)->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF0F4F8']],
            'font' => ['italic' => true, 'size' => 10, 'color' => ['argb' => 'FF2C6D9B']],
        ]);

        // Column widths
        $sheet->getColumnDimension('A')->setWidth(18);
        $sheet->getColumnDimension('B')->setWidth(18);
        $sheet->getColumnDimension('C')->setWidth(78);

        $sheet->freezePane('A5');
    }
}