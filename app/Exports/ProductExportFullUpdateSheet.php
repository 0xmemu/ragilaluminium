<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Sheet B "Update Produk Lengkap": SATU BARIS = SATU VARIAN, untuk edit
 * metadata + media varian tertentu. Target = parent_sku + variant_sku.
 * Identitas produk diulang tiap baris (konteks). Media level produk di baris
 * pertama grup; media varian (pola image_variation_* sama dgn template import)
 * di baris varian. Cell kosong = tidak mengubah existing.
 */
class ProductExportFullUpdateSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Produk Lengkap';
        $widths = ['A' => 20, 'B' => 30, 'C' => 34, 'D' => 40];
        foreach (['E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL'] as $c) { $widths[$c] = 18; }
        $this->columnWidths = $widths;
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants', 'media.mediaAsset']);
    }

    /** @return list<string> */
    public function headings(): array
    {
        return [
            'parent_sku', 'variant_sku', 'variant_combination',
            'name', 'description', 'product_category', 'product_model', 'design_variant',
            'variation_1_name', 'variation_1_option', 'variation_2_name', 'variation_2_option',
            'price', 'stock',
            'weight_kg', 'height_cm', 'width_cm', 'depth_cm', 'specifications',
            'image_1', 'image_2', 'image_3', 'image_4', 'image_5',
            'image_6', 'image_7', 'image_8', 'image_9',
            'image_variation_1_option_1', 'image_variation_1_option_2', 'image_variation_1_option_3', 'image_variation_1_option_4',
            'image_variation_2_option_1', 'image_variation_2_option_2', 'image_variation_2_option_3', 'image_variation_2_option_4',
            'shared_media_1', 'shared_media_2',
            'installation_image_1', 'installation_image_2',
        ];
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $rows = [];

        $main = [];
        $shared = [];
        $installation = [];
        $optionImages = [];
        foreach ($product->media->sortBy('position')->values() as $m) {
            $url = (string) ($m->urlFor('pdp') ?? $m->mediaAsset?->urlFor('pdp') ?? '');
            if ($url === '') { continue; }
            if ($m->position === 1) { $main[0] = $url; continue; }
            if ($m->position >= 2 && $m->position <= 9) { $main[$m->position - 1] = $url; continue; }
            if ($m->position >= 11 && $m->position <= 19) { $shared[] = $url; continue; }
            if ($m->position >= 50 && $m->position <= 79) { $optionImages[] = $url; continue; }
            if ($m->position >= 101) { $installation[] = $url; }
        }

        $variants = $product->variants->sortBy('id')->values();
        $first = $variants->first();

        foreach ($variants as $index => $variant) {
            $firstRow = $index === 0;
            $row = [
                $product->parent_sku,
                $variant->variant_sku,
                $this->combination($variant),
                $product->name,
                $product->description,
                $product->product_category,
                $product->product_model,
                $product->design_variant,
                $first?->variation_1_name,
                $first?->variation_1_option,
                $first?->variation_2_name,
                $first?->variation_2_option,
                (float) $variant->price,
                (int) $variant->stock,
                (float) $product->weight_kg,
                (float) $product->height_cm,
                (float) $product->width_cm,
                (float) $product->depth_cm,
                $product->specifications,
            ];
            // Media parent diulang di SEMUA baris grup (pola sama dgn file
            // import owner): nilai sama per posisi, importer menjamin tetap
            // satu media per posisi (baris pertama menang).
            // Urutan kolom ikut template import: image_1..9, image_variation_*,
            // shared_media_*, installation_image_* (sama dgn urutan galeri:
            // umum > per opsi > shared > installation).
            $row = array_merge($row, [
                $main[0] ?? null,
                $main[1] ?? null,
                $main[2] ?? null,
                $main[3] ?? null,
                $main[4] ?? null,
                $main[5] ?? null,
                $main[6] ?? null,
                $main[7] ?? null,
                $main[8] ?? null,
            ]);
            // Media per opsi varian.
            foreach ([1, 2, 3, 4, 5, 6, 7, 8] as $opt) {
                $row[] = $optionImages[$opt - 1] ?? null;
            }
            // Shared media (foto/video bersama).
            $row[] = $shared[0] ?? null;
            $row[] = $shared[1] ?? null;
            // Installation.
            $row[] = $installation[0] ?? null;
            $row[] = $installation[1] ?? null;

            $rows[] = array_map([ExportSafety::class, 'cell'], $row);
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
