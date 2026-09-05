<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Sheet tunggal: salinan PERSIS sheet Data template import katalog.
 * Header = dataHeaders() template (38 kolom, urutan asli, tanpa dihilangkan).
 * id_key diisi SKU produk (parent_sku). 1 baris = 1 kombinasi; identitas,
 * media, spesifikasi di baris pertama grup (semantik import).
 */
class ProductExportDataSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Data';
        $this->columnWidths = ['A' => 14, 'B' => 34, 'C' => 40]
            + array_fill_keys(['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL'], 20);
        $this->currencyColumns = ['S'];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants', 'media.mediaAsset']);
    }

    public function headings(): array
    {
        return \App\Exports\CatalogTemplateExport::dataHeaders();
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $headers = \App\Exports\CatalogTemplateExport::dataHeaders();
        $rows = [];

        $variants = $product->variants->sortBy('id')->values();
        $mainImage = null;
        $secondImage = null;
        $shared = [];
        $installation = [];
        $optionImages = [];
        foreach ($product->media->sortBy('position')->values() as $m) {
            $url = (string) ($m->stored_url ?? $m->source_url ?? '');
            if ($url === '') { continue; }
            if ($m->position === 1) { $mainImage = $url; continue; }
            if ($m->position >= 2 && $m->position <= 9) { $secondImage = $secondImage ?? $url; continue; }
            if ($m->position >= 11 && $m->position <= 19) { $shared[] = $url; continue; }
            if ($m->position >= 50 && $m->position <= 79) { $optionImages[] = $url; continue; }
            if ($m->position >= 101) { $installation[] = $url; }
        }

        foreach ($variants as $index => $variant) {
            $first = $index === 0;
            $row = array_fill(0, count($headers), null);

            foreach ($headers as $col => $header) {
                $row[$col] = match (true) {
                    $header === 'id_key' => $first ? $product->parent_sku : null,
                    $header === 'name' => $first ? $product->name : null,
                    $header === 'description' => $first ? $product->description : null,
                    $header === 'product_category' => $first ? $product->product_category : null,
                    $header === 'product_model' => $first ? $product->product_model : null,
                    $header === 'design_variant' => $first ? $product->design_variant : null,
                    $header === 'specifications' => $first ? ($product->specifications ?? null) : null,
                    $header === 'weight_kg' => $first ? (float) $product->weight_kg : null,
                    $header === 'height_cm' => $first ? (float) $product->height_cm : null,
                    $header === 'width_cm' => $first ? (float) $product->width_cm : null,
                    $header === 'depth_cm' => $first ? (float) $product->depth_cm : null,
                    $header === 'image_1' => $first ? $mainImage : null,
                    $header === 'image_2' => $first ? $secondImage : null,
                    $header === 'shared_media_1' => $first ? ($shared[0] ?? null) : null,
                    $header === 'shared_media_2' => $first ? ($shared[1] ?? null) : null,
                    $header === 'installation_image_1' => $first ? ($installation[0] ?? null) : null,
                    $header === 'installation_image_2' => $first ? ($installation[1] ?? null) : null,
                    str_starts_with($header, 'image_variation_') => $first ? $this->optionImage($header, $optionImages) : null,
                    str_starts_with($header, 'variation_') && str_ends_with($header, '_name') => $first ? ($variant->{$header} ?? null) : null,
                    str_starts_with($header, 'variation_') && str_ends_with($header, '_option_1') => $first ? ($variant->{str_replace('_option_1', '_option', $header)} ?? null) : null,
                    $header === 'variantion_combination' || $header === 'variation_combination' => $this->combination($variant),
                    $header === 'price_variantion_combination' => (float) $variant->price,
                    $header === 'stock' => (int) $variant->stock,
                    default => null,
                };
            }

            $rows[] = array_map([ExportSafety::class, 'cell'], $row);
        }

        return $rows;
    }

    protected function optionImage(string $header, array $optionImages): ?string
    {
        if (preg_match('/image_variation_(\d+)_option_(\d+)/', $header, $m)) {
            $slot = ((int) $m[1] - 1) * 4 + ((int) $m[2] - 1);
            return $optionImages[$slot] ?? null;
        }

        return null;
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
