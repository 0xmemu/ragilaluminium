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
            'name', 'description', 'product_category',
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
        $this->styleHeader($sheet, 'A', 'Q');
        $this->setColumnWidths($sheet);
        $sheet->freezePane('A2');

        $lastRow = max($sheet->getHighestRow(), 200);
        $this->addListValidation($sheet, 'C', CatalogLabels::categoryCodes(), $lastRow);
        $this->addListValidation($sheet, 'D', CatalogLabels::modelCodes(), $lastRow);
        $this->addListValidation($sheet, 'E', CatalogLabels::designCodes(), $lastRow);
        $this->addListValidation($sheet, 'Q', ['draft', 'archived', 'active'], $lastRow);
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
            'A' => 40, 'B' => 40, 'C' => 14,
            'D' => 12, 'E' => 12, 'F' => 12, 'G' => 12, 'H' => 12,
            'I' => 12, 'J' => 14, 'K' => 10, 'L' => 10, 'M' => 10,
            'N' => 10, 'O' => 10, 'P' => 34, 'Q' => 10,
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
                'name', 'description', 'product_category',
                'product_model', 'design_variant', 'variation_1_name', 'variation_1_option',
                'variation_2_name', 'variation_2_option', 'price', 'stock', 'weight_kg',
                'height_cm', 'width_cm', 'depth_cm', 'specifications', 'status',
            ],
            [
                'Jendela Aluminium Jungkit Ornamen 200x180',
                'Jendela jungkit aluminium dengan ornamen, kaca bening.', 'JENDELA',
                'JUNGKIT', 'ORNEMEN', 'Warna', 'Hitam', 'Kaca', 'Bening',
                '10170000', '3', '45', '200', '180', '10',
                '[{"name":"Bahan","value":"Aluminium"}]', 'draft',
            ],
            [
                'Jendela Aluminium Jungkit Ornamen 200x180',
                'Jendela jungkit aluminium dengan ornamen, kaca bening.', 'JENDELA',
                'JUNGKIT', 'ORNEMEN', 'Warna', 'Putih', 'Kaca', 'Bening',
                '10170000', '4', '45', '200', '180', '10',
                '[{"name":"Bahan","value":"Aluminium"}]', 'draft',
            ],
            [
                'Pintu Aluminium Sliding 100x220',
                'Pintu sliding aluminium standar, kaca buram.', 'PINTU',
                'SLIDING', 'POLOS', 'Warna', 'Silver', 'Kaca', 'Buram',
                '5400000', '2', '30', '100', '220', '8',
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
        $sheet->mergeCells('A1:Q1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        // Row 2: subtitle
        $sheet->mergeCells('A2:Q2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT],
        ]);

        // Row 4: header
        $sheet->getStyle('A4:Q4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(26);

        // Rows 5-7: example data with zebra
        $cols = range('A', 'Q');
        $zebraFills = ['FFFFFFFF', 'FFF7F8F7'];
        for ($i = 0; $i < 3; $i++) {
            $row = 5 + $i;
            $fill = $zebraFills[$i % 2];
            $sheet->getStyle('A'.$row.':Q'.$row)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
            ]);
            if ($fill !== 'FFFFFFFF') {
                $sheet->getStyle('A'.$row.':Q'.$row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color($fill));
            }
        }

        // Row 9: note
        $sheet->mergeCells('A9:Q9');
        $sheet->getStyle('A9')->applyFromArray([
            'font' => ['size' => 9, 'color' => ['argb' => 'FF666666'], 'italic' => true],
        ]);

        // Freeze below header
        $sheet->freezePane('A5');

        // Column widths
        $w = [
            'A' => 40, 'B' => 40, 'C' => 14,
            'D' => 12, 'E' => 12, 'F' => 12, 'G' => 12, 'H' => 12,
            'I' => 12, 'J' => 14, 'K' => 10, 'L' => 10, 'M' => 10,
            'N' => 10, 'O' => 10, 'P' => 34, 'Q' => 10,
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
            ['name', 'WAJIB', 'Nama produk yang tampil di toko. Baris dengan nama sama dianggap varian dari produk yang sama.'],
            ['SKU (parent & varian)', 'OTOMATIS', 'Tidak perlu diisi. Sistem membuat SKU otomatis (pola RGL-{angka acak} untuk produk, RGL-{parent}-{urutan} untuk varian). SKU terlihat setelah ekspor atau template update harga/stok.'],

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
            ['CATATAN', '', 'Isi satu baris per varian di sheet Data. Baris dengan nama sama akan menjadi varian produk yang sama (SKU dibuat otomatis). Jangan ubah nama kolom (snake_case). Gunakan sheet Contoh sebagai rujukan.'],
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