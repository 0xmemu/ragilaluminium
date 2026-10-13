<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template Update Harga & Stok (kontrak export-as-update 09-06):
 * header identik dengan sheet "Update Harga & Stok" di export produk.
 * Sheet Data diisi 2 produk contoh nyata (SKU + URL media nyata dari DB);
 * baris contoh diawali catatan agar admin hapus sebelum import.
 */
class StockPriceTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new StockPriceDataSheet(),
            new StockPriceGuideSheet(),
        ];
    }

    public static function headers(): array
    {
        return ['parent_sku', 'variant_sku', 'variant_combination', 'price', 'stock'];
    }
}

class StockPriceDataSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $rows = [StockPriceTemplateExport::headers()];
        foreach (self::contohRows() as $r) { $rows[] = $r; }

        return $rows;
    }

    /** Contoh nyata: produk + varian pertamanya, harga/stok saat ini. */
    public static function contohRows(): array
    {
        $out = [];
        $products = \App\Models\Product::with('variants')->orderByDesc('id')->limit(2)->get();
        foreach ($products as $p) {
            $v = $p->variants->sortBy('id')->first();
            if (! $v) { continue; }
            $parts = [];
            foreach ([$v->variation_1_option, $v->variation_2_option, $v->variation_3_option] as $o) {
                $o = trim((string) $o);
                if ($o !== '') { $parts[] = $o; }
            }
            $out[] = [
                'CATATAN: 2 baris berikut contoh. HAPUS sebelum import.',
                $v->variant_sku,
                implode(', ', $parts),
                (float) $v->price,
                (int) $v->stock,
            ];
        }

        return $out;
    }

    public function title(): string { return 'Data'; }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $sheet->getStyle('A1:E1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);
        $sheet->getColumnDimension('A')->setWidth(22);
        $sheet->getColumnDimension('B')->setWidth(28);
        $sheet->getColumnDimension('C')->setWidth(34);
        $sheet->getColumnDimension('D')->setWidth(14);
        $sheet->getColumnDimension('E')->setWidth(12);
        $sheet->freezePane('A2');
    }
}

class StockPriceGuideSheet implements FromArray, WithTitle
{
    public function array(): array
    {
        return [
            ['PANDUAN UPDATE HARGA & STOK', 'Ragil Aluminium'],
            [],
            ['KOLOM', 'WAJIB', 'KETERANGAN'],
            ['parent_sku', 'YA', 'SKU produk (kolom A). Ambil dari Export Produk.'],
            ['variant_sku', 'YA', 'SKU varian yang diupdate. Satu baris = satu varian.'],
            ['variant_combination', 'TIDAK', 'Keterangan kombinasi. Hanya untuk dibaca manusia, tidak diproses.'],
            ['price', 'opsional', 'Angka murni tanpa Rp dan tanpa pemisah ribuan, contoh 1500000. Kosong = harga tidak diubah.'],
            ['stock', 'opsional', 'Angka bulat, contoh 10, atau rentang, contoh 5-8. Kosong = stok tidak diubah.'],
            [],
            ['ATURAN PENTING', '', ''],
            ['1', '', 'HAPUS baris contoh sebelum import.'],
            ['2', '', 'parent_sku + variant_sku tidak boleh muncul dua kali di file.'],
            ['3', '', 'Cell kosong TIDAK mengubah data existing.'],
            ['4', '', 'Selalu jalankan Periksa file sebelum Mulai Import.'],
            ['5', '', 'Salah SKU = baris gagal; tidak pernah membuat produk/varian baru.'],
        ];
    }

    public function title(): string { return 'Panduan'; }
}
