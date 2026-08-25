<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Template Update Harga & Stok (mini): 2 sheet Contoh + Panduan.
 */
class StockPriceTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new StockPriceExampleSheet(),
            new StockPriceGuideSheet(),
        ];
    }
}

class StockPriceExampleSheet implements FromArray
{
    public function array(): array
    {
        return [
            ['parent_sku', 'variant_sku', 'price', 'stock'],
            ['RGL-JNG-JKT-1', 'RGL-JNG-JKT-1-H', '11000000', '5'],
            ['RGL-PNT-SLD-1', 'RGL-PNT-SLD-1-P', '5700000', '4'],
        ];
    }

    public function title(): string
    {
        return 'Contoh';
    }
}

class StockPriceGuideSheet implements FromArray
{
    public function array(): array
    {
        return [
            ['KOLOM', 'WAJIB/OPTIONAL', 'KETERANGAN'],
            ['parent_sku', 'WAJIB BILA TANPA variant_sku', 'Kode produk utama. Harus sudah ada; tidak dikenal = baris gagal.'],
            ['variant_sku', 'OPTIONAL', 'Kode varian. Kosongkan untuk menuju varian default produk.'],
            ['price', 'WAJIB', 'Harga satuan baru (Rupiah, desimal titik).'],
            ['stock', 'WAJIB', 'Stok baru (bilangan bulat >= 0).'],
            ['CATATAN', '', 'Mode ini HANYA mengubah harga dan stok. Kolom lain di file diabaikan. Produk/varian baru tidak akan dibuat.'],
        ];
    }

    public function title(): string
    {
        return 'Panduan';
    }
}