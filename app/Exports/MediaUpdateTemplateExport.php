<?php

namespace App\Exports;

use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Support\CatalogDownloadFilter;
use App\Support\CatalogTemplateV2;
use App\Support\CatalogTemplateV2Styler;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;

/**
 * Template Update Media v2: ubah foto produk dan varian yang sudah ada.
 *
 * Dua sheet: Update Media (data nyata dari DB, sudah tersaring) dan Panduan.
 * Empat kolom pertama adalah identitas yang DIKUNCI dan divalidasi ulang di
 * server. Seluruh kolom media DIBIARKAN KOSONG saat diunduh supaya tidak ada
 * gambar tertimpa tanpa sengaja (keputusan owner).
 *
 * Aturan sel: kosong berarti tidak mengubah. Penghapusan media dilakukan
 * lewat panel admin media, bukan lewat template.
 */
class MediaUpdateTemplateExport implements WithMultipleSheets
{
    public function __construct(private CatalogDownloadFilter $filter = new CatalogDownloadFilter())
    {
    }

    public function sheets(): array
    {
        return [
            new MediaUpdateDataSheet($this->filter),
            new MediaUpdateGuideSheet($this->filter),
        ];
    }

    /** @return list<array{header: string, slug: string, group: int, locked: bool}> */
    public static function columns(): array
    {
        return CatalogTemplateV2::updateMediaColumns();
    }

    /** @return list<string> */
    public static function headers(): array
    {
        return CatalogTemplateV2::headers(self::columns());
    }

    public static function columnCount(): int
    {
        return count(self::columns());
    }

}

/**
 * Sheet data Update Media: satu baris = satu varian. Kolom identitas terisi,
 * seluruh kolom media KOSONG supaya admin mengisi hanya yang ingin diubah.
 */
class MediaUpdateDataSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function __construct(private CatalogDownloadFilter $filter)
    {
    }

    public function array(): array
    {
        $idx = [];
        foreach (MediaUpdateTemplateExport::columns() as $i => $col) {
            $idx[$col['slug']] = $i;
        }

        $rows = [MediaUpdateTemplateExport::headers()];

        $this->filter->products()->chunk(200, function ($products) use (&$rows, $idx): void {
            foreach ($products as $product) {
                foreach ($product->variants->sortBy('id') as $variant) {
                    $rows[] = self::line($product, $variant, $idx);
                }
            }
        });

        return $rows;
    }

    /** Kolom media sengaja null: sel kosong berarti tidak mengubah media. */
    private static function line(Product $product, ProductVariant $variant, array $idx): array
    {
        $line = array_fill(0, MediaUpdateTemplateExport::columnCount(), null);
        $line[$idx['sku_produk']] = (string) $product->parent_sku;
        $line[$idx['nama_produk']] = (string) $product->name;
        $line[$idx['sku_varian']] = (string) $variant->variant_sku;
        $line[$idx['variasi']] = CatalogTemplateV2::variationLabel($variant);

        return $line;
    }

    public function title(): string
    {
        return 'Update Media';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $columns = MediaUpdateTemplateExport::columns();
        $lastRow = max($sheet->getHighestRow(), CatalogTemplateV2Styler::FIRST_DATA_ROW);

        CatalogTemplateV2Styler::styleHeader($sheet, $columns);
        CatalogTemplateV2Styler::applyAutoFilter($sheet, count($columns));
        CatalogTemplateV2Styler::applyWidths($sheet, [
            'A' => 18, 'B' => 40, 'C' => 18, 'D' => 26,
            'E' => 44, 'F' => 44, 'G' => 44, 'H' => 44, 'I' => 44, 'J' => 44, 'K' => 44,
        ]);
        CatalogTemplateV2Styler::forceTextColumns($sheet, [1, 3], $lastRow);
        CatalogTemplateV2Styler::protectLockedColumns($sheet, $columns, $lastRow);
    }
}

/** Sheet Panduan Update Media. Tanpa Contoh, sesuai keputusan owner. */
class MediaUpdateGuideSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function __construct(private CatalogDownloadFilter $filter)
    {
    }

    public function array(): array
    {
        $rows = [
            ['PANDUAN UPDATE MEDIA', 'Ragil Aluminium'],
            ['Cakupan unduhan', $this->filter->summary(), ''],
            [],
            ['LEGENDA WARNA HEADER', '', ''],
        ];

        foreach (CatalogTemplateV2::GROUP_LABELS as $group => $label) {
            $rows[] = ['', $label, self::groupColumns($group)];
        }

        $rows[] = [];
        $rows[] = ['KAMUS KOLOM', 'BISA DIUBAH', 'KETERANGAN'];
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
        foreach (MediaUpdateTemplateExport::columns() as $i => $col) {
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
            ['SKU Produk', 'TIDAK', 'Kunci produk. DIKUNCI, jangan diubah.'],
            ['Nama Produk', 'TIDAK', 'Hanya penanda bacaan.'],
            ['SKU Varian', 'TIDAK', 'Kunci varian. DIKUNCI, jangan diubah.'],
            ['Variasi', 'TIDAK', 'Penanda bacaan kombinasi varian.'],
            ['Gambar per Varian', 'YA', 'URL foto yang menempel pada varian baris ini.'],
            ['Gambar 1 (utama)', 'YA', 'URL foto utama katalog produk.'],
            ['Gambar 2', 'YA', 'URL foto katalog kedua.'],
            ['Gambar 3', 'YA', 'URL foto katalog ketiga.'],
            ['Media Bersama 1', 'YA', 'URL media yang dipakai semua varian produk.'],
            ['Media Bersama 2', 'YA', 'URL media bersama kedua.'],
            ['Gambar Hasil Pemasangan 1', 'YA', 'URL foto dokumentasi pemasangan.'],
            ['Gambar Hasil Pemasangan 2', 'YA', 'URL foto pemasangan kedua.'],
        ];
    }

    /** @return list<string> */
    private static function rules(): array
    {
        return [
            'Berkas ini hanya MENGGANTI media. Harga, stok, deskripsi, dan spesifikasi tidak disentuh; itu ada di template Update Produk.',
            'Empat kolom pertama dikunci. Kolom itu tidak boleh diubah, dan server tetap menolaknya walau kunci dibuka.',
            'Sel kosong berarti TIDAK mengubah media. Seluruh kolom media sengaja dikosongkan supaya tidak ada gambar tertimpa tanpa sengaja.',
            'Penghapusan media dilakukan lewat panel admin media. Sel kosong tidak pernah menghapus.',
            'URL harus URL publik yang bisa dibuka, bukan nama file atau kode objek.',
            'Satu baris = satu varian. Jangan menambah atau menghapus baris.',
            'Selalu tekan Periksa file sebelum Mulai Import.',
            'Proteksi Excel mencegah salah isi, bukan keamanan. Sistem tetap menolak perubahan SKU walau proteksi dilepas.',
        ];
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FFC20000']],
        ]);
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF1F497D']],
        ]);
        $sheet->getStyle('B2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF1F497D']],
        ]);

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

        $sheet->getColumnDimension('A')->setWidth(24);
        $sheet->getColumnDimension('B')->setWidth(14);
        $sheet->getColumnDimension('C')->setWidth(78);
        $last = max($sheet->getHighestRow(), 1);
        $sheet->getStyle('C1:C'.$last)->getAlignment()->setWrapText(true);
    }
}
