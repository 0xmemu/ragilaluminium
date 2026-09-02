<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Product;
use App\Support\CatalogLabels;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ProductExport extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Laporan Produk';
        $this->columnWidths = [
            'A' => 18, 'B' => 34, 'C' => 14, 'D' => 14, 'E' => 14,
            'F' => 14, 'G' => 16, 'H' => 12, 'I' => 14, 'J' => 12, 'K' => 20,
        ];
        $this->currencyColumns = ['G'];
        $this->quantityColumns = ['H', 'I', 'J'];
    }

    public function query()
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query;
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'SKU Induk', 'Nama Produk', 'Kategori', 'Model', 'Sub Model', 'Status',
            'Harga Mulai', 'Total Stok', 'Jumlah Varian', 'Terjual', 'Diperbarui',
        ]);
    }

    public function map($product): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            $product->parent_sku,
            $product->name,
            CatalogLabels::category($product->product_category),
            CatalogLabels::model($product->product_model),
            CatalogLabels::design($product->design_variant),
            $this->productStatusLabel($product->status),
            (float) $product->min_price,
            $product->stock_total,
            $product->variants_count,
            $product->sold_count,
            $this->formatWib($product->updated_at),
        ]);
    }

    protected function productStatusLabel(?string $status): string
    {
        return match ($status) {
            'active' => 'Aktif',
            'archived' => 'Arsip',
            'draft' => 'Draft',
            default => $status ?? '-',
        };
    }
}
