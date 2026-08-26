<?php

namespace App\Exports;

use App\Support\CatalogLabels;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template import katalog (XLSX): 3 sheet Data / Contoh / Panduan.
 * Header sengaja tetap snake_case karena processor import membaca by key
 * (WithHeadingRow). Human-friendly dicapai via dropdown enum + sheet Panduan.
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
        $lastRow = max($sheet->getHighestRow(), 200); // beri ruang drop-down hingga baris 200
        $this->addListValidation($sheet, 'E', CatalogLabels::categoryCodes(), $lastRow);
        $this->addListValidation($sheet, 'F', CatalogLabels::modelCodes(), $lastRow);
        $this->addListValidation($sheet, 'G', CatalogLabels::designCodes(), $lastRow);
        $this->addListValidation($sheet, 'S', ['draft', 'archived', 'active'], $lastRow);
    }

    protected function addListValidation($sheet, string $col, array $values, int $lastRow): void
    {
        $values = array_values(array_unique(array_filter($values)));
        if ($values === []) {
            return;
        }
        $formula = implode(',', $values);
        // Excel membatasi panjang formula validasi 255 karakter.
        if (strlen($formula) > 250) {
            return;
        }
        $range = $col.'2:'.$col.$lastRow;
        $validation = $sheet->getCell($col.'2')->getDataValidation();
        $validation->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
        $validation->setAllowBlank(true);
        $validation->setShowDropDown(true);
        $validation->setFormula1('"'.$formula.'"');
        $validation->setError('Nilai tidak ada dalam daftar. Pilih dari dropdown.');
        $validation->setErrorTitle('Pilihan tidak valid');
        $sheet->setDataValidation($range, $validation);
    }
}

class CatalogTemplateExampleSheet implements FromArray, WithTitle
{
    public function array(): array
    {
        return [
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
        ];
    }

    public function title(): string
    {
        return 'Contoh';
    }
}

class CatalogTemplateGuideSheet implements FromArray, WithTitle
{
    public function array(): array
    {
        return [
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['parent_sku', 'WAJIB', 'Kode produk utama. Harus unik. Baris dengan parent_sku sama akan memperbarui produk yang sudah ada.'],
            ['variant_sku', 'OPTIONAL', 'Kode varian. Kosongkan bila produk tidak punya varian. Wajib bila satu parent memiliki banyak pilihan (warna/ukuran/kaca).'],
            ['name', 'WAJIB', 'Nama produk yang tampil di toko.'],
            ['description', 'OPTIONAL', 'Deskripsi produk.'],
            ['product_category', 'WAJIB', 'Kategori. Pilih dari dropdown (mis. JENDELA, PINTU). Kategori tak dikenal ditandai untuk tinjauan admin.'],
            ['product_model', 'WAJIB', 'Model. Pilih dari dropdown (mis. JUNGKIT, SLIDING, SWING, KACA_MATI, ZIGZAG).'],
            ['design_variant', 'WAJIB', 'Desain. Pilih dari dropdown (mis. POLOS, ORNAMEN, KOMBINASI).'],
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
            ['specifications', 'OPTIONAL', 'Spesifikasi dalam format JSON, mis. [{"name":"Bahan","value":"Aluminium"}].'],
            ['status', 'WAJIB', 'Status awal. Pilih dari dropdown: draft, archived, active.'],
            ['CATATAN', '', 'Isi satu produk per baris di sheet Data. Jangan ubah nama kolom (snake_case). Gunakan sheet Contoh sebagai rujukan.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }
}
