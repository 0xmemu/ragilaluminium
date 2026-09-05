<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Product;
use App\Support\CatalogLabels;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Export Laporan Produk - format detail (owner 2026-09-05).
 *
 * 3 sheet:
 *  1. Ringkasan Produk   : 1 baris = 1 produk (identitas + agregat).
 *  2. Detail Varian & Media : 1 baris = 1 varian, diikuti baris media
 *     yang menempel varian; media level produk (tanpa varian) satu blok
 *     per produk di akhir grup (tidak diulang per varian).
 *  3. Atribut Produk     : 1 baris = 1 atribut.
 */
class ProductExport extends RagilStyledExport implements WithMultipleSheets
{
    public function __construct(protected Builder $query)
    {
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query;
    }

    /** @return array<int, mixed> */
    public function sheets(): array
    {
        return [
            // SATU sheet saja: salinan persis sheet Data template import
            // katalog, header & urutan dari dataHeaders() template, id_key
            // = SKU produk. 1 baris = 1 kombinasi (kontrak owner 09-05).
            new ProductExportDataSheet($this->query),
        ];
    }
}

/**
 * Sheet 1: Ringkasan Produk.
 */
class ProductExportSummarySheet extends RagilStyledExport implements FromQuery, WithHeadings, \Maatwebsite\Excel\Concerns\WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Ringkasan Produk';
        $this->columnWidths = [
            'A' => 18, 'B' => 40, 'C' => 12, 'D' => 14, 'E' => 14,
            'F' => 12, 'G' => 46, 'H' => 10, 'I' => 11, 'J' => 11,
            'K' => 11, 'L' => 12, 'M' => 15, 'N' => 15, 'O' => 11,
            'P' => 9, 'Q' => 12, 'R' => 16, 'S' => 18, 'T' => 18,
        ];
        $this->currencyColumns = ['M', 'N'];
        $this->quantityColumns = ['H', 'I', 'J', 'K', 'L', 'O', 'P', 'Q', 'R'];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query;
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'SKU Induk', 'Nama Produk', 'Kategori', 'Model', 'Sub Model', 'Status',
            'Deskripsi', 'Berat (kg)', 'Tinggi (cm)', 'Panjang (cm)', 'Lebar (cm)',
            'Jumlah Varian', 'Harga Mulai', 'Harga Maks', 'Total Stok', 'Terjual',
            'Jumlah Media', 'Jumlah Media Installation', 'Dibuat (WIB)', 'Diperbarui (WIB)',
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
            (string) $product->description,
            (float) $product->weight_kg,
            (float) $product->height_cm,
            (float) $product->width_cm,
            (float) $product->depth_cm,
            (int) $product->variants_count,
            (float) $product->min_price,
            (float) $product->max_price,
            (int) $product->stock_total,
            (int) $product->sold_count,
            (int) $product->media_count,
            (int) $product->installation_media_count,
            $this->formatWib($product->created_at),
            $this->formatWib($product->updated_at),
        ]);
    }

    protected function productStatusLabel(?string $status): string
    {
        return match ($status) {
            'active' => 'Aktif',
            'archived' => 'Arsip',
            'draft' => 'Draf',
            default => (string) $status,
        };
    }
}

/**
 * Sheet 2: Detail Varian & Media.
 */
class ProductExportDetailSheet extends RagilStyledExport implements FromQuery, WithHeadings, \Maatwebsite\Excel\Concerns\WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Detail Varian & Media';
        $this->columnWidths = [
            'A' => 18, 'B' => 36, 'C' => 18, 'D' => 20, 'E' => 20, 'F' => 20,
            'G' => 20, 'H' => 20, 'I' => 12, 'J' => 15, 'K' => 9,
            'L' => 12, 'M' => 13, 'N' => 13, 'O' => 13, 'P' => 10,
            'Q' => 11, 'R' => 12, 'S' => 16, 'T' => 17, 'U' => 10,
            'V' => 13, 'W' => 60,
        ];
        $this->currencyColumns = ['J'];
        $this->quantityColumns = ['K', 'L', 'M', 'N', 'O', 'Q'];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants', 'media.mediaAsset', 'attributes']);
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'SKU Induk', 'Nama Produk', 'SKU Varian',
            'Varian 1', 'Varian 2', 'Varian 3', 'Varian 4', 'Varian 5',
            'Status Varian', 'Harga', 'Stok',
            'Berat Varian (kg)', 'Tinggi Varian (cm)', 'Panjang Varian (cm)', 'Lebar Varian (cm)',
            'Jenis Baris', 'Media Posisi', 'Media Utama', 'Media Installation',
            'Media Tampil di Katalog', 'Media Jenis', 'Media Status', 'Media URL',
        ]);
    }

    /**
     * 1 produk menghasilkan beberapa baris: varian-varian lalu media level
     * produk. FromQuery + WithMapping memanggil map() per model produk.
     *
     * @return list<array<int, mixed>>
     */
    public function map($product): array
    {
        $rows = [];

        // Baris per varian
        foreach ($product->variants as $variant) {
            $rows[] = array_map([ExportSafety::class, 'cell'], [
                $product->parent_sku,
                $product->name,
                $variant->variant_sku,
                $this->variantLabel($variant->variation_1_name, $variant->variation_1_option),
                $this->variantLabel($variant->variation_2_name, $variant->variation_2_option),
                $this->variantLabel($variant->variation_3_name, $variant->variation_3_option),
                $this->variantLabel($variant->variation_4_name, $variant->variation_4_option),
                $this->variantLabel($variant->variation_5_name, $variant->variation_5_option),
                $this->variantStatusLabel($variant->status),
                (float) $variant->price,
                (int) $variant->stock,
                $variant->weight_kg !== null ? (float) $variant->weight_kg : null,
                $variant->height_cm !== null ? (float) $variant->height_cm : null,
                $variant->width_cm !== null ? (float) $variant->width_cm : null,
                $variant->depth_cm !== null ? (float) $variant->depth_cm : null,
                'VARIAN',
                null, null, null, null, null, null, null,
            ]);

            // Media yang menempel varian ini
            foreach ($this->variantMedia($product, $variant->id) as $media) {
                $rows[] = $this->mediaRow($product, $media);
            }
        }

        // Media level produk (tanpa varian): sekali per produk, bukan per varian
        foreach ($product->media->whereNull('product_variant_id') as $media) {
            $rows[] = $this->mediaRow($product, $media);
        }

        return $rows;
    }

    /** @return Collection<int, mixed> */
    protected function variantMedia(Product $product, int $variantId): Collection
    {
        return $product->media->where('product_variant_id', $variantId)
            ->sortBy('position')
            ->values();
    }

    /** @return list<mixed> */
    protected function mediaRow(Product $product, $media): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            $product->parent_sku,
            $product->name,
            null, // SKU varian kosong: media level produk
            null, null, null, null, null,
            null,
            null, null, null, null, null, null,
            'MEDIA',
            (int) $media->position,
            $media->is_main_image ? 'Ya' : 'Tidak',
            $media->is_installation ? 'Ya' : 'Tidak',
            $media->show_in_catalog ? 'Ya' : 'Tidak',
            $this->mediaKindLabel($media),
            (string) ($media->status ?? ''),
            (string) ($media->stored_url ?? $media->source_url ?? ''),
        ]);
    }

    protected function variantLabel(?string $name, ?string $option): ?string
    {
        $name = trim((string) $name);
        $option = trim((string) $option);
        if ($name === '' && $option === '') {
            return null;
        }
        if ($name === '') {
            return $option;
        }

        return $name.': '.$option;
    }

    protected function variantStatusLabel(?string $status): string
    {
        return match ($status) {
            'active' => 'Aktif',
            'archived' => 'Arsip',
            'draft' => 'Draf',
            default => (string) $status,
        };
    }

    protected function mediaKindLabel($media): string
    {
        $kind = $media->mediaAsset?->kind;
        if ($kind === 'video') {
            return 'video';
        }
        if (str_contains((string) $media->mime_type, 'video')) {
            return 'video';
        }

        return 'foto';
    }
}

/**
 * Sheet 3: Atribut Produk.
 */
class ProductExportAttributesSheet extends RagilStyledExport implements FromQuery, WithHeadings, \Maatwebsite\Excel\Concerns\WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Atribut Produk';
        $this->columnWidths = [
            'A' => 18, 'B' => 40, 'C' => 26, 'D' => 50,
        ];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['attributes']);
    }

    public function headings(): array
    {
        return array_map([ExportSafety::class, 'cell'], [
            'SKU Induk', 'Nama Produk', 'Nama Atribut', 'Nilai',
        ]);
    }

    /**
     * @return list<array<int, mixed>>
     */
    public function map($product): array
    {
        $rows = [];
        foreach ($product->attributes as $attribute) {
            $rows[] = array_map([ExportSafety::class, 'cell'], [
                $product->parent_sku,
                $product->name,
                (string) $attribute->attribute_name,
                (string) $attribute->attribute_value,
            ]);
        }

        return $rows;
    }
}
