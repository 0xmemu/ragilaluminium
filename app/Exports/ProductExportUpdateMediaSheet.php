<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Exports\CatalogTemplateExport;
use App\Support\ExportSafety;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Sheet paste-ready "Update Media": kolom & urutan IDENTIK dengan sheet Data
 * template import katalog (matriks yang sama dengan sheet Update Harga &
 * Stok), tapi kolom media diisi dari database sesuai kontrak importer:
 *
 *  - image_1, image_2            : media level produk utama & lanjutan.
 *  - image_variation_N_option_M  : gambar per opsi varian.
 *  - shared_media_1..2           : media bersama (foto/video).
 *  - installation_image_1..2     : media hasil pemasangan.
 *  - variantion_combination      : kombinasi varian (baris varian jadi).
 *
 * Satu baris = satu kombinasi varian. Kolom identitas/definisi opsi/media
 * cukup di baris pertama grup (semantik sama dengan file import).
 */
class ProductExportUpdateMediaSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Media';
        $this->columnWidths = array_merge(
            ['A' => 14, 'B' => 34, 'C' => 40],
            array_fill_keys(['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL'], 24)
        );
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants', 'media.mediaAsset']);
    }

    public function headings(): array
    {
        return CatalogTemplateExport::dataHeaders();
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $headers = CatalogTemplateExport::dataHeaders();
        $rows = [];

        $variants = $product->variants->sortBy('id')->values();

        // Peta media produk per kelas posisi (kontrak importer):
        // 1..9 katalog umum, 11..19 shared, 50..79 gambar per opsi, 101+ installation.
        $media = $product->media->sortBy('position')->values();
        $mainImage = null;
        $secondImage = null;
        $shared = [];
        $installation = [];
        $optionImages = [];
        foreach ($media as $m) {
            $url = (string) ($m->stored_url ?? $m->source_url ?? '');
            if ($url === '') { continue; }
            if ($m->position === 1) { $mainImage = $url; continue; }
            if ($m->position >= 2 && $m->position <= 9) { $secondImage = $secondImage ?? $url; continue; }
            if ($m->position >= 11 && $m->position <= 19) { $shared[] = $url; continue; }
            if ($m->position >= 50 && $m->position <= 79) { $optionImages[] = $url; continue; }
            if ($m->position >= 101) { $installation[] = $url; }
        }

        foreach ($variants as $index => $variant) {
            $row = array_fill(0, count($headers), null);

            foreach ($headers as $col => $header) {
                $row[$col] = match ($header) {
                    'id_key' => $index === 0 ? $product->parent_sku : null,
                    'name' => $index === 0 ? $product->name : null,
                    'product_category' => $index === 0 ? $product->product_category : null,
                    'product_model' => $index === 0 ? $product->product_model : null,
                    'design_variant' => $index === 0 ? $product->design_variant : null,
                    'variation_1_name' => $index === 0 ? $variant->variation_1_name : null,
                    'variation_1_option_1' => $index === 0 ? $variant->variation_1_option : null,
                    'variation_2_name' => $index === 0 ? $variant->variation_2_name : null,
                    'variation_2_option_1' => $index === 0 ? $variant->variation_2_option : null,
                    'variantion_combination', 'variation_combination' => $this->combination($variant),
                    'price_variantion_combination' => (float) $variant->price,
                    'stock' => (int) $variant->stock,
                    'image_1' => $index === 0 ? $mainImage : null,
                    'image_2' => $index === 0 ? $secondImage : null,
                    'shared_media_1' => $index === 0 ? ($shared[0] ?? null) : null,
                    'shared_media_2' => $index === 0 ? ($shared[1] ?? null) : null,
                    'image_variation_1_option_1', 'image_variation_1_option_2', 'image_variation_1_option_3', 'image_variation_1_option_4',
                    'image_variation_2_option_1', 'image_variation_2_option_2', 'image_variation_2_option_3', 'image_variation_2_option_4' => $index === 0 ? $this->optionImageByColumn($header, $optionImages) : null,
                    'installation_image_1' => $index === 0 ? ($installation[0] ?? null) : null,
                    'installation_image_2' => $index === 0 ? ($installation[1] ?? null) : null,
                    default => null,
                };
            }

            $rows[] = array_map([ExportSafety::class, 'cell'], $row);
        }

        return $rows;
    }

    /**
     * Gambar per opsi disimpan berurutan (posisi 50..79) sesuai urutan
     * penautan importer: per slot varian, opsi urut. Petakan balik ke kolom
     * image_variation_N_option_M.
     */
    protected function optionImageByColumn(string $header, array $optionImages): ?string
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
