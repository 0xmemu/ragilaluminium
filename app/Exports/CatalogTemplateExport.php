<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Template import katalog (XLSX): 3 sheet Data / Contoh / Panduan.
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

class CatalogTemplateDataSheet implements FromArray
{
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
}

class CatalogTemplateExampleSheet implements FromArray
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

class CatalogTemplateGuideSheet implements FromArray
{
    public function array(): array
    {
        return [
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['parent_sku', 'WAJIB', 'Kode produk utama; unik. SKU ada = update, SKU baru = dibuat dengan status archived.'],
            ['variant_sku', 'OPTIONAL', 'Kode varian; unik. Kosongkan bila produk tanpa varian.'],
            ['name', 'WAJIB', 'Nama produk (akan dipakai pencarian).'],
            ['description', 'OPTIONAL', 'Deskripsi panjang produk.'],
            ['product_category', 'WAJIB', 'Kategori: JENDELA, PINTU, atau BOVEN (alias lama WINDOW/DOOR/BOUVEN tetap diterima).'],
            ['product_model', 'WAJIB', 'Model: JUNGKIT, SLIDING, SWING, LIPAT, FIXED, atau lainnya dari tabel model.'],
            ['design_variant', 'WAJIB', 'Desain: ORNEMEN, POLOS, MINIMALIS, atau lainnya dari tabel desain.'],
            ['variation_1_name / variation_1_option', 'OPTIONAL', 'Contoh: Warna / Hitam.'],
            ['variation_2_name / variation_2_option', 'OPTIONAL', 'Contoh: Kaca / Bening.'],
            ['price', 'WAJIB', 'Harga satuan varian dalam Rupiah. Gunakan angka desimal dengan titik (mis. 10170000.5).'],
            ['stock', 'WAJIB', 'Jumlah stok varian (bilangan bulat >= 0).'],
            ['weight_kg', 'OPTIONAL', 'Berat packing dalam kilogram (desimal titik).'],
            ['height_cm / width_cm / depth_cm', 'OPTIONAL', 'Dimensi packing dalam cm.'],
            ['specifications', 'OPTIONAL', 'JSON array of {"name","value"} atau baris "Nama:Nilai" dipisah titik koma.'],
            ['status', 'OPTIONAL', 'draft / archived / active. Produk baru selalu dimulai archived.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }
}