<?php

namespace App\Exports;

use App\Models\Product;
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
 * Template Update Produk v2: ubah harga, stok, deskripsi, dan spesifikasi
 * produk yang sudah ada.
 *
 * Dua sheet: Update Produk (data nyata dari DB, sudah tersaring) dan Panduan.
 * Empat kolom pertama adalah identitas yang DIKUNCI di Excel dan tetap
 * divalidasi ulang di server. Kolom Harga, Stok, Deskripsi, dan Spesifikasi
 * diisi NILAI SEKARANG supaya admin melihat angka lama (keputusan owner).
 *
 * Template ini bukan tempat membuat produk baru. Baris yang SKU-nya tidak
 * dikenal akan ditolak importer.
 */
class ProductUpdateTemplateExport implements WithMultipleSheets
{
    public function __construct(private CatalogDownloadFilter $filter = new CatalogDownloadFilter())
    {
    }

    public function sheets(): array
    {
        return [
            new ProductUpdateDataSheet($this->filter),
            new ProductUpdateGuideSheet($this->filter),
        ];
    }

    /** @return list<array{header: string, slug: string, group: int, locked: bool}> */
    public static function columns(): array
    {
        return CatalogTemplateV2::updateProductColumns();
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
 * Sheet data Update Produk: satu baris = satu varian, terisi data sekarang.
 */
class ProductUpdateDataSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function __construct(private CatalogDownloadFilter $filter)
    {
    }

    public function array(): array
    {
        $idx = [];
        foreach (ProductUpdateTemplateExport::columns() as $i => $col) {
            $idx[$col['slug']] = $i;
        }

        $rows = [ProductUpdateTemplateExport::headers()];

        $this->filter->products()->chunk(200, function ($products) use (&$rows, $idx): void {
            foreach ($products as $product) {
                foreach ($product->variants->sortBy('id') as $variant) {
                    $rows[] = self::line($product, $variant, $idx);
                }
            }
        });

        return $rows;
    }

    /**
     * Satu baris data. Kolom identitas dan kolom boleh-ubah sama-sama terisi
     * nilai sekarang; yang membedakan adalah pengunciannya di Excel.
     */
    private static function line(Product $product, ProductVariant $variant, array $idx): array
    {
        $line = array_fill(0, ProductUpdateTemplateExport::columnCount(), null);
        $line[$idx['sku_produk']] = (string) $product->parent_sku;
        $line[$idx['nama_produk']] = (string) $product->name;
        $line[$idx['sku_varian']] = (string) $variant->variant_sku;
        $line[$idx['variasi']] = CatalogTemplateV2::variationLabel($variant);
        $line[$idx['harga']] = (float) $variant->price;
        $line[$idx['stok']] = (int) $variant->stock;
        $line[$idx['deskripsi_produk']] = (string) ($product->description ?? '');
        $line[$idx['spesifikasi']] = self::specifications($product);

        return $line;
    }

    /** Spesifikasi produk sebagai "Nama: Nilai" dipisah koma. */
    public static function specifications(Product $product): string
    {
        $attrs = $product->relationLoaded('attributes')
            ? $product->attributes
            : $product->attributes()->get();

        return $attrs
            ->map(fn ($a) => trim((string) $a->attribute_name).': '.trim((string) $a->attribute_value))
            ->filter(fn (string $line) => $line !== ':')
            ->implode(', ');
    }

    public function title(): string
    {
        return 'Update Produk';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();
        $columns = ProductUpdateTemplateExport::columns();
        $lastRow = max($sheet->getHighestRow(), CatalogTemplateV2Styler::FIRST_DATA_ROW);

        CatalogTemplateV2Styler::styleHeader($sheet, $columns);
        CatalogTemplateV2Styler::applyAutoFilter($sheet, count($columns));
        CatalogTemplateV2Styler::applyWidths($sheet, [
            'A' => 18, 'B' => 40, 'C' => 18, 'D' => 26,
            'E' => 14, 'F' => 10, 'G' => 44, 'H' => 30,
        ]);
        // SKU dan nama adalah identitas: paksa teks supaya angka panjang tidak
        // berubah jadi notasi ilmiah sebelum dikirim balik ke server.
        CatalogTemplateV2Styler::forceTextColumns($sheet, [1, 3], $lastRow);
        // Rentang terkunci cukup sampai baris data terakhir: template update
        // jumlah barisnya tetap, admin tidak menambah baris.
        CatalogTemplateV2Styler::protectLockedColumns($sheet, $columns, $lastRow);
    }
}

/**
 * Sheet Panduan Update Produk. Tanpa sheet Contoh sesuai keputusan owner,
 * karena bentuk barisnya sudah nyata dari data yang diunduh.
 */
class ProductUpdateGuideSheet implements FromArray, WithTitle, WithEvents
{
    use RegistersEventListeners;

    public function __construct(private CatalogDownloadFilter $filter)
    {
    }

    public function array(): array
    {
        $rows = [
            ['PANDUAN UPDATE PRODUK', 'Ragil Aluminium'],
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
        foreach (ProductUpdateTemplateExport::columns() as $i => $col) {
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
            ['SKU Produk', 'TIDAK', 'Kunci produk. DIKUNCI, jangan diubah. Mengubahnya membuat baris ditolak.'],
            ['Nama Produk', 'TIDAK', 'Hanya penanda bacaan. Nama produk diubah lewat menu Produk, bukan lewat berkas ini.'],
            ['SKU Varian', 'TIDAK', 'Kunci varian. DIKUNCI, jangan diubah.'],
            ['Variasi', 'TIDAK', 'Penanda bacaan kombinasi varian, mis. Putih, Kaca Bening.'],
            ['Harga', 'YA', 'Harga jual varian. Angka polos tanpa titik dan tanpa Rp.'],
            ['Stok', 'YA', 'Jumlah stok. Angka biasa, atau format acak seperti random 1000-8000.'],
            ['Deskripsi Produk', 'YA', 'Deskripsi produk. Berlaku untuk seluruh varian produk itu.'],
            ['Spesifikasi', 'YA', 'Pasangan Nama: Nilai dipisah koma. Berlaku untuk produk itu.'],
        ];
    }

    /** @return list<string> */
    private static function rules(): array
    {
        return [
            'Berkas ini hanya MENGUBAH produk yang sudah ada. Tidak bisa membuat produk atau varian baru.',
            'Empat kolom pertama dikunci. Kolom itu tidak boleh diubah, dan server tetap menolaknya walau kunci dibuka.',
            'Sel kosong berarti TIDAK mengubah data. Kosongkan sel yang tidak ingin diubah.',
            'Kolom Harga, Stok, Deskripsi, dan Spesifikasi sudah berisi nilai sekarang sebagai pembanding.',
            'Satu baris = satu varian. Jangan menambah atau menghapus baris.',
            'Biarkan kolom identitas apa adanya supaya baris tetap cocok dengan sistem.',
            'Selalu tekan Periksa file sebelum Mulai Import.',
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

        $sheet->getColumnDimension('A')->setWidth(18);
        $sheet->getColumnDimension('B')->setWidth(14);
        $sheet->getColumnDimension('C')->setWidth(78);
        $last = max($sheet->getHighestRow(), 1);
        $sheet->getStyle('C1:C'.$last)->getAlignment()->setWrapText(true);
    }
}
