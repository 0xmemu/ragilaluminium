<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Sheet paste-ready: kolom & urutan IDENTIK dengan sheet data template
 * Update Harga & Stok. 1 baris = 1 varian aktif; harga & stok = nilai
 * sekarang (siap diedit admin lalu paste balik ke template).
 */
class ProductExportUpdatePriceStockSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Harga & Stok';
        $this->columnWidths = ['A' => 18, 'B' => 20, 'C' => 14, 'D' => 10];
        $this->currencyColumns = ['C'];
        $this->quantityColumns = ['D'];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants']);
    }

    public function headings(): array
    {
        // Persis sheet data template Update Harga & Stok.
        return ['parent_sku', 'variant_sku', 'price', 'stock'];
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $rows = [];
        foreach ($product->variants->where('status', 'active') as $variant) {
            $rows[] = array_map([ExportSafety::class, 'cell'], [
                $product->parent_sku,
                $variant->variant_sku,
                (float) $variant->price,
                (int) $variant->stock,
            ]);
        }

        return $rows;
    }
}
