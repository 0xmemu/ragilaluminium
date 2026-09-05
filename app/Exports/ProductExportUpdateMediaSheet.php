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
 * Update Media. 1 baris = 1 varian aktif; kolom image_N berisi URL media
 * varian itu urut posisi; installation_image_N = media installation varian;
 * installation_slots = slot image_N yang juga installation (kontrak template).
 * Media level produk TIDAK diulang per varian (ada di sheet Detail).
 */
class ProductExportUpdateMediaSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Media';
        $this->columnWidths = [
            'A' => 18, 'B' => 20,
            'C' => 40, 'D' => 40, 'E' => 40, 'F' => 40, 'G' => 40, 'H' => 40, 'I' => 40, 'J' => 40, 'K' => 40,
            'L' => 40, 'M' => 40, 'N' => 40, 'O' => 40, 'P' => 40, 'Q' => 40, 'R' => 40, 'S' => 40, 'T' => 40,
            'U' => 18,
        ];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants', 'media']);
    }

    public function headings(): array
    {
        // Persis sheet data template Update Media.
        $headings = ['parent_sku', 'variant_sku'];
        for ($i = 1; $i <= 9; $i++) { $headings[] = 'image_'.$i; }
        for ($i = 1; $i <= 9; $i++) { $headings[] = 'installation_image_'.$i; }
        $headings[] = 'installation_slots';

        return $headings;
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $rows = [];
        foreach ($product->variants->where('status', 'active') as $variant) {
            $images = [];
            $installationImages = [];
            $installationSlots = [];
            $catalogPos = 0;
            $installPos = 0;
            $variantMedia = $product->media->where('product_variant_id', $variant->id)->sortBy('position')->values();
            foreach ($variantMedia as $media) {
                $url = (string) ($media->stored_url ?? $media->source_url ?? '');
                if ($url === '') { continue; }
                if ($media->is_installation) {
                    $installPos++;
                    if ($installPos <= 9) { $installationImages[$installPos - 1] = $url; }
                    // Slot image_N yang juga installation (media installation
                    // yang juga tampil di katalog, hitung posisinya di image_N).
                    if ($media->show_in_catalog) {
                        $catalogSlot = 0;
                        foreach ($variantMedia as $m2) {
                            if ($m2->is_installation || ! $m2->show_in_catalog) { continue; }
                            $catalogSlot++;
                            if ($m2->id === $media->id) { $installationSlots[] = $catalogSlot; break; }
                        }
                    }
                } elseif ($media->show_in_catalog) {
                    $catalogPos++;
                    if ($catalogPos <= 9) { $images[$catalogPos - 1] = $url; }
                }
            }
            $row = [$product->parent_sku, $variant->variant_sku];
            for ($i = 0; $i < 9; $i++) { $row[] = $images[$i] ?? null; }
            for ($i = 0; $i < 9; $i++) { $row[] = $installationImages[$i] ?? null; }
            $row[] = $installationSlots !== [] ? implode(',', array_unique($installationSlots)) : null;
            $rows[] = array_map([ExportSafety::class, 'cell'], $row);
        }

        return $rows;
    }
}
