<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template Update Harga & Stok (XLSX): 3 sheet Data / Contoh / Panduan.
 * Sheet pertama WAJIB Data (kosong, header by key) karena processor
 * (ImportStockPriceUpdate, WithHeadingRow) membaca sheet pertama; contoh
 * tidak boleh ikut diproses sebagai data asli.
 */
class StockPriceTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new StockPriceDataSheet(),
            new StockPriceExampleSheet(),
            new StockPriceGuideSheet(),
        ];
    }
}

// ------ DATA (sheet pertama, dibaca processor) ------

class StockPriceDataSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [[
            'parent_sku', 'variant_sku', 'price', 'stock',
        ]];
    }

    public function title(): string
    {
        return 'Data';
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

        $sheet->getColumnDimension('A')->setWidth(18);
        $sheet->getColumnDimension('B')->setWidth(22);
        $sheet->getColumnDimension('C')->setWidth(14);
        $sheet->getColumnDimension('D')->setWidth(10);

        $sheet->getStyle('C2:C10000')->getNumberFormat()->setFormatCode('#,##0');
        $sheet->getStyle('D2:D10000')->getNumberFormat()->setFormatCode('0');

        $sheet->freezePane('A2');
    }
}

// ------ CONTOH ------

class StockPriceExampleSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['CONTOH UPDATE HARGA & STOK', 'Ragil Aluminium'],
            ['Isi data harga/stok baru di sheet Data. Contoh di bawah hanya ilustrasi, tidak diproses.'],
            [],
            ['parent_sku', 'variant_sku', 'price', 'stock'],
            ['RA2J8RZXC2JR', '', '11000000', '5'],
            ['RADTEADUQ7DD', '', '5700000', '4'],
            [],
            ['^ Contoh format (SKU nyata milik sistem). parent_sku WAJIB; variant_sku boleh kosong (menuju varian default). SKU asli tiap produk ada di menu Produk.'],
        ];
    }

    public function title(): string
    {
        return 'Contoh';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->mergeCells('A1:D1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $sheet->mergeCells('A2:D2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
        ]);

        $sheet->getStyle('A4:D4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(26);

        $zebraFills = ['FFFFFFFF', 'FFF7F8F7', 'FFFFFFFF'];
        for ($i = 0; $i < 3; $i++) {
            $row = 5 + $i;
            $sheet->getStyle('A'.$row.':D'.$row)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
            ]);
            if ($zebraFills[$i] !== 'FFFFFFFF') {
                $sheet->getStyle('A'.$row.':D'.$row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color($zebraFills[$i]));
            }
        }

        $sheet->mergeCells('A9:D9');
        $sheet->getStyle('A9')->applyFromArray([
            'font' => ['size' => 9, 'color' => ['argb' => 'FF666666'], 'italic' => true],
        ]);

        $sheet->getColumnDimension('A')->setWidth(18);
        $sheet->getColumnDimension('B')->setWidth(22);
        $sheet->getColumnDimension('C')->setWidth(14);
        $sheet->getColumnDimension('D')->setWidth(10);

        $sheet->getStyle('C5:C7')->getNumberFormat()->setFormatCode('#,##0');
        $sheet->getStyle('D5:D7')->getNumberFormat()->setFormatCode('0');

        $sheet->freezePane('A5');
    }
}

// ------ PANDUAN ------

class StockPriceGuideSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['PANDUAN UPDATE HARGA & STOK', 'Ragil Aluminium'],
            ['Mode ini HANYA mengubah harga dan stok. Produk/varian baru tidak dibuat.'],
            [],
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['parent_sku', 'WAJIB BILA TANPA variant_sku', 'Kode produk utama. Harus sudah ada; tidak dikenal = baris gagal.'],
            ['variant_sku', 'OPTIONAL', 'Kode varian. Kosongkan untuk menuju varian default produk.'],
            ['price', 'OPTIONAL', 'Harga satuan baru (Rupiah, angka, tanpa titik ribuan). Sel kosong = harga tidak diubah.'],
            ['stock', 'OPTIONAL', 'Stok baru (bilangan bulat >= 0). Sel kosong = stok tidak diubah. Bisa juga \"random 8000-9000\" untuk stok acak pada rentang itu (inklusi).'],
            ['CATATAN', '', 'Kolom lain di file diabaikan. SKU tidak dikenal ditandai gagal, tidak membuat produk baru. Salin parent_sku/variant_sku asli dari menu Produk (atau export Produk), jangan ketik pola dari ingatan.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->mergeCells('A1:C1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $sheet->mergeCells('A2:C2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
        ]);

        $sheet->getStyle('A4:C4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(26);

        $last = $sheet->getHighestRow();
        $sheet->getStyle('A5:C'.$last)->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
            'alignment' => ['wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);

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

        $sheet->getStyle('A'.$last.':C'.$last)->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF0F4F8']],
            'font' => ['italic' => true, 'size' => 10, 'color' => ['argb' => 'FF2C6D9B']],
        ]);

        $sheet->getColumnDimension('A')->setWidth(26);
        $sheet->getColumnDimension('B')->setWidth(26);
        $sheet->getColumnDimension('C')->setWidth(70);

        $sheet->freezePane('A5');
    }
}