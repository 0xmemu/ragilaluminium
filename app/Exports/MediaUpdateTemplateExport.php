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
 * Template Update Media (kontrak export-as-update 09-06):
 * header + urutan identik sheet "Update Produk Lengkap" (blok media).
 * Kolom media berseri mengikuti pemakaian dataset (minimal _1):
 * image_1..N, image_variation_*, shared_media_1..2, installation_image_1..2.
 * Sheet Data diisi contoh nyata dari DB.
 */
class MediaUpdateTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new MediaUpdateDataSheet(),
            new MediaUpdateGuideSheet(),
        ];
    }

    /** Kolom media sesuai pemakaian dataset (sama dgn export). */
    public static function headers(): array
    {
        $cols = ['parent_sku', 'variant_sku'];
        [$main, $optSlots, $shared, $inst] = self::seriesUsage();
        for ($i = 1; $i <= $main; $i++) { $cols[] = 'image_'.$i; }
        for ($slot = 0; $slot < $optSlots; $slot++) {
            $cols[] = 'image_variation_'.(intdiv($slot, 4) + 1).'_option_'.(($slot % 4) + 1);
        }
        for ($i = 1; $i <= $shared; $i++) { $cols[] = 'shared_media_'.$i; }
        for ($i = 1; $i <= $inst; $i++) { $cols[] = 'installation_image_'.$i; }

        return $cols;
    }

    /** @return array{0:int,1:int,2:int,3:int} main,optSlots,shared,installation */
    public static function seriesUsage(): array
    {
        $rows = \Illuminate\Support\Facades\DB::table('product_media')
            ->selectRaw('position, COUNT(*) c')->groupBy('position')->pluck('c', 'position');
        $main = 1;
        foreach (range(2, 9) as $p) { if (($rows[$p] ?? 0) > 0) { $main = max($main, $p); } }
        $optSlots = 1;
        foreach (range(50, 79) as $p) { if (($rows[$p] ?? 0) > 0) { $optSlots = max($optSlots, $p - 49); } }
        $shared = 1;
        foreach (range(12, 19) as $p) { if (($rows[$p] ?? 0) > 0) { $shared = max($shared, $p - 10); } }
        $inst = 1;
        foreach (range(102, 119) as $p) { if (($rows[$p] ?? 0) > 0) { $inst = max($inst, $p - 100); } }

        return [$main, $optSlots, $shared, $inst];
    }
}

class MediaUpdateDataSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function array(): array
    {
        $rows = [MediaUpdateTemplateExport::headers()];
        foreach (self::contohRows() as $r) { $rows[] = $r; }

        return $rows;
    }

    /** Contoh nyata: produk dgn media terbanyak + varian pertamanya. */
    public static function contohRows(): array
    {
        $out = [];
        $p = \App\Models\Product::with(['variants', 'media'])->orderByDesc('id')->first();
        if (! $p) { return $out; }
        $v = $p->variants->sortBy('id')->first();
        if (! $v) { return $out; }

        $main = []; $opt = []; $shared = []; $inst = [];
        foreach ($p->media->sortBy('position') as $m) {
            $url = (string) ($m->urlFor('pdp') ?? '');
            if ($url === '') { continue; }
            if ($m->position === 1) { $main[0] = $url; continue; }
            if ($m->position >= 2 && $m->position <= 9) { $main[$m->position - 1] = $url; continue; }
            if ($m->position >= 11 && $m->position <= 19) { $shared[] = $url; continue; }
            if ($m->position >= 50 && $m->position <= 79) { $opt[] = $url; continue; }
            if ($m->position >= 101) { $inst[] = $url; }
        }

        [$nMain, $nOpt, $nShared, $nInst] = MediaUpdateTemplateExport::seriesUsage();
        $row = [$p->parent_sku, $v->variant_sku];
        for ($i = 1; $i <= $nMain; $i++) { $row[] = $main[$i - 1] ?? null; }
        for ($s = 0; $s < $nOpt; $s++) { $row[] = $opt[$s] ?? null; }
        for ($i = 1; $i <= $nShared; $i++) { $row[] = $shared[$i - 1] ?? null; }
        for ($i = 1; $i <= $nInst; $i++) { $row[] = $inst[$i - 1] ?? null; }
        $out[] = array_merge(
            ['CATATAN: baris berikut contoh nyata. HAPUS sebelum import.'],
            array_slice($row, 1)
        );

        return $out;
    }

    public function title(): string { return 'Data'; }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $headers = MediaUpdateTemplateExport::headers();
        $last = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));
        $sheet->getStyle('A1:'.$last.'1')->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(26);
        $sheet->getColumnDimension('A')->setWidth(20);
        $sheet->getColumnDimension('B')->setWidth(28);
        foreach (range(3, count($headers)) as $n) {
            $sheet->getColumnDimensionByColumn($n)->setWidth(42);
        }
        $sheet->freezePane('C2');
    }
}

class MediaUpdateGuideSheet implements FromArray, WithTitle
{
    public function array(): array
    {
        return [
            ['PANDUAN UPDATE MEDIA', 'Ragil Aluminium'],
            [],
            ['KOLOM', 'WAJIB', 'KETERANGAN'],
            ['parent_sku', 'YA', 'SKU produk (kolom A). Ambil dari Export Produk.'],
            ['variant_sku', 'YA', 'SKU varian target. Harus benar-benar milik parent_sku.'],
            ['image_1..N', 'opsional', 'Foto umum produk, image_1 = foto utama. N mengikuti pemakaian; butuh lebih, tambah kolom image_N+1 sendiri.'],
            ['image_variation_N_option_M', 'opsional', 'Foto per pilihan varian. Pola sama dengan template import katalog; butuh lebih, tambah kolom option_M+1 sendiri.'],
            ['shared_media_N', 'opsional', 'Foto/video bersama semua kombinasi; butuh lebih, tambah shared_media_N+1 sendiri.'],
            ['installation_image_N', 'opsional', 'Foto hasil pemasangan; butuh lebih, tambah installation_image_N+1 sendiri.'],
            [],
            ['ATURAN PENTING', '', ''],
            ['1', '', 'HAPUS baris contoh sebelum import.'],
            ['2', '', 'Cell media kosong TIDAK menghapus media existing.'],
            ['3', '', 'URL harus URL publik canonical (media.333labs.tech), bukan nama file atau object key.'],
            ['4', '', 'parent_sku + variant_sku tidak boleh muncul dua kali di file.'],
            ['5', '', 'Selalu jalankan Periksa file sebelum Mulai Import.'],
            ['6', '', 'Hapus media dilakukan lewat Media Library, bukan dengan mengosongkan cell.'],
        ];
    }

    public function title(): string { return 'Panduan'; }
}
