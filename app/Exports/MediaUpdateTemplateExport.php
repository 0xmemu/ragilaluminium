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
 * Template Update Media (XLSX): 3 sheet Data / Contoh / Panduan.
 * Sheet pertama WAJIB Data (kosong, header by key) karena processor
 * (ImportMediaUpdate, WithHeadingRow) membaca sheet pertama; contoh tidak
 * boleh ikut diproses sebagai data asli.
 */
class MediaUpdateTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new MediaUpdateDataSheet(),
            new MediaUpdateExampleSheet(),
            new MediaUpdateGuideSheet(),
        ];
    }

    /**
     * Header kolom (21): kunci SKU + 9 foto katalog + 9 foto pemasangan + slots.
     */
    public static function headers(): array
    {
        $cols = ['parent_sku', 'variant_sku'];
        foreach (range(1, 9) as $n) {
            $cols[] = 'image_'.$n;
        }
        foreach (range(1, 9) as $n) {
            $cols[] = 'installation_image_'.$n;
        }

        return array_merge($cols, ['installation_slots']);
    }
}

// ------ DATA (sheet pertama, dibaca processor) ------

class MediaUpdateDataSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [MediaUpdateTemplateExport::headers()];
    }

    public function title(): string
    {
        return 'Data';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $last = 'U1';
        $sheet->getStyle('A1:'.$last)->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);

        $sheet->getColumnDimension('A')->setWidth(18);
        $sheet->getColumnDimension('B')->setWidth(22);
        foreach (range(3, 20) as $n) {
            $sheet->getColumnDimensionByColumn($n)->setWidth(46);
        }
        $sheet->getColumnDimension('U')->setWidth(14);

        $sheet->freezePane('A2');
    }
}

// ------ CONTOH ------

class MediaUpdateExampleSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        $h = MediaUpdateTemplateExport::headers();

        return [
            ['CONTOH UPDATE MEDIA', 'Ragil Aluminium'],
            ['Isi URL foto di sheet Data. Contoh di bawah hanya ilustrasi, tidak diproses.'],
            [],
            $h,
            [
                'RGL-JNG-JKT-1', 'RGL-JNG-JKT-1-H',
                'https://media.example.com/jendela-hitam-1.png',
                'https://media.example.com/jendela-hitam-2.png',
                null, null, null, null, null, null, null,
                'https://media.example.com/jendela-hitam-pasang-1.png',
                null, null, null, null, null, null, null, null,
                null,
            ],
            [
                'RGL-JNG-JKT-1', 'RGL-JNG-JKT-1-P',
                'https://media.example.com/jendela-putih-1.png',
                'https://media.example.com/jendela-putih-2.png',
                'https://media.example.com/jendela-putih-3.png',
                null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                '2,3',
            ],
            [
                'RGL-PNT-SLD-1', '',
                'https://media.example.com/pintu-sliding-1.png',
                'https://media.example.com/pintu-sliding-2.png',
                null, null, null, null, null, null, null,
                'https://media.example.com/pintu-sliding-pasang-1.png',
                null, null, null, null, null, null, null, null,
                null,
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

        $sheet->mergeCells('A1:U1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $sheet->mergeCells('A2:U2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
        ]);

        $sheet->getStyle('A4:U4')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(26);

        $zebraFills = ['FFFFFFFF', 'FFF7F8F7', 'FFFFFFFF'];
        for ($i = 0; $i < 3; $i++) {
            $row = 5 + $i;
            $sheet->getStyle('A'.$row.':U'.$row)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
            ]);
            if ($zebraFills[$i] !== 'FFFFFFFF') {
                $sheet->getStyle('A'.$row.':U'.$row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color($zebraFills[$i]));
            }
        }

        $sheet->mergeCells('A9:U9');
        $sheet->getStyle('A9')->applyFromArray([
            'font' => ['size' => 9, 'color' => ['argb' => 'FF666666'], 'italic' => true],
        ]);

        $sheet->getColumnDimension('A')->setWidth(18);
        $sheet->getColumnDimension('B')->setWidth(22);
        foreach (range(3, 20) as $n) {
            $sheet->getColumnDimensionByColumn($n)->setWidth(46);
        }
        $sheet->getColumnDimension('U')->setWidth(14);

        $sheet->freezePane('A5');
    }
}

// ------ PANDUAN ------

class MediaUpdateGuideSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['PANDUAN UPDATE MEDIA', 'Ragil Aluminium'],
            ['Mode ini HANYA mengubah foto produk/varian (foto katalog + foto hasil pemasangan). Produk/varian baru tidak dibuat.'],
            [],
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['parent_sku', 'WAJIB', 'Kode produk utama. Harus sudah ada; tidak dikenal = baris gagal.'],
            ['variant_sku', 'OPTIONAL', 'Kode varian. Kosongkan untuk foto level produk (dipakai semua varian).'],
            ['image_1 .. image_9', 'OPTIONAL', 'URL foto katalog. image_1 = foto utama. Sel kosong = foto yang ada tidak diubah.'],
            ['installation_image_1 .. installation_image_9', 'OPTIONAL', 'URL foto hasil pemasangan (tidak tampil di katalog; tampil di halaman Hasil Pemasangan).'],
            ['installation_slots', 'OPTIONAL', 'Nomor slot image_1..9 yang juga tampil di Hasil Pemasangan. Contoh: "7,8,9" berarti image_7,8,9 juga jadi foto pemasangan.'],
            ['CATATAN', '', 'Mode ini tidak membuat produk baru, tidak menghapus foto, dan tidak mengubah harga/stok. Menghapus foto: lewat halaman Media produk. URL internal Media Library dipakai langsung; URL eksternal hanya fase test/dev.'],
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