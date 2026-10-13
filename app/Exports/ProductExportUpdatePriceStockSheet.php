<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Sheet A "Update Harga & Stok": SATU BARIS = SATU VARIAN yang dijual.
 * Target update = parent_sku + variant_sku (SKU varian existing, stabil).
 * Kolom: parent_sku, variant_sku, variant_combination (konteks manusiawi),
 * price, stock. Nilai numeric murni tanpa format.
 * Cell kosong price/stock = tidak diubah importer.
 */
class ProductExportUpdatePriceStockSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Harga & Stok';
        $this->columnWidths = ['A' => 20, 'B' => 30, 'C' => 36, 'D' => 14, 'E' => 10];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with('variants');
    }

    public function headings(): array
    {
        return ['parent_sku', 'variant_sku', 'variant_combination', 'price', 'stock'];
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $rows = [];
        foreach ($product->variants->sortBy('id')->values() as $variant) {
            $rows[] = array_map([ExportSafety::class, 'cell'], [
                $product->parent_sku,
                $variant->variant_sku,
                $this->combination($variant),
                (float) $variant->price,
                (int) $variant->stock,
            ]);
        }

        return $rows;
    }

    protected function combination($variant): ?string
    {
        $parts = [];
        foreach ([$variant->variation_1_option, $variant->variation_2_option, $variant->variation_3_option, $variant->variation_4_option, $variant->variation_5_option] as $opt) {
            $opt = trim((string) $opt);
            if ($opt !== '') { $parts[] = $opt; }
        }

        return $parts !== [] ? implode(', ', $parts) : null;
    }
}
