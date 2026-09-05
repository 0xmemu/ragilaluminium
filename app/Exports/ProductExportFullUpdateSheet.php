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
 * metadata + media. Target = parent_sku + variant_sku.
 *
 * Kolom ber-Series _N (image_N, shared_media_N, installation_image_N)
 * digenerate SESUAI PEMAKAIAN: kolom tanpa isi sama sekali di seluruh
 * dataset tidak dicetak. Minimal _1 selalu ada.
 */
class ProductExportFullUpdateSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    /** Jumlah kolom per series yang benar-benar dipakai (dihitung saat boot). */
    protected int $maxMain = 1;

    protected int $maxShared = 1;

    protected int $maxInstallation = 1;

    protected int $maxOptionSlots = 1;

    protected bool $seriesResolved = false;

    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Produk Lengkap';
        $widths = ['A' => 20, 'B' => 30, 'C' => 34, 'D' => 40];
        foreach (['E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL'] as $c) { $widths[$c] = 18; }
        $this->columnWidths = $widths;
    }

    /**
     * Hitung pemakaian kolom _N dari DB sekali (per dataset).
     */
    protected function resolveSeries(): void
    {
        if ($this->seriesResolved) { return; }
        $this->seriesResolved = true;

        $rows = \Illuminate\Support\Facades\DB::table('product_media')
            ->selectRaw('position, COUNT(*) c')
            ->groupBy('position')
            ->pluck('c', 'position');

        // image_N: posisi 1..9 (umum), minimal image_1.
        $maxMain = 1;
        foreach (range(2, 9) as $p) {
            if (($rows[$p] ?? 0) > 0) { $maxMain = max($maxMain, $p); }
        }
        $this->maxMain = $maxMain;

        // shared_media_N: posisi 11..19, minimal shared_media_1.
        $maxShared = 1;
        foreach (range(12, 19) as $p) {
            if (($rows[$p] ?? 0) > 0) { $maxShared = max($maxShared, $p - 10); }
        }
        $this->maxShared = $maxShared;

        // installation_image_N: posisi 101..119, minimal installation_image_1.
        $maxInst = 1;
        foreach (range(102, 119) as $p) {
            if (($rows[$p] ?? 0) > 0) { $maxInst = max($maxInst, $p - 100); }
        }
        $this->maxInstallation = $maxInst;

        // Slot gambar per opsi: image_variation_1_option_1..4 dst. Hitung
        // berapa kombinasi (varian, opsi) yang benar-benar punya media.
        // Pos 50..79: slot = ((varian-1)*4)+(opsi-1), varian 1..5, opsi 1..4.
        $used = \Illuminate\Support\Facades\DB::table('product_media')
            ->whereBetween('position', [50, 79])
            ->whereNotNull('product_id')
            ->count();
        $maxSlots = 1;
        if ($used > 0) {
            $positions = \Illuminate\Support\Facades\DB::table('product_media')->whereBetween('position', [50, 79])->pluck('position');
            foreach ($positions as $p) {
                $slot = $p - 50; // 0..29
                $maxSlots = max($maxSlots, $slot + 1);
            }
        }
        $this->maxOptionSlots = $maxSlots;
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants', 'media.mediaAsset']);
    }

    /** @return list<string> */
    public function headings(): array
    {
        $this->resolveSeries();

        $headings = [
            'parent_sku', 'variant_sku', 'variant_combination',
            'name', 'description', 'product_category', 'product_model', 'design_variant',
            'variation_1_name', 'variation_1_option', 'variation_2_name', 'variation_2_option',
            'price', 'stock',
            'weight_kg', 'height_cm', 'width_cm', 'depth_cm', 'specifications',
        ];
        for ($i = 1; $i <= $this->maxMain; $i++) { $headings[] = 'image_'.$i; }
        for ($slot = 0; $slot < $this->maxOptionSlots; $slot++) {
            $var = intdiv($slot, 4) + 1;
            $opt = ($slot % 4) + 1;
            $headings[] = 'image_variation_'.$var.'_option_'.$opt;
        }
        for ($i = 1; $i <= $this->maxShared; $i++) { $headings[] = 'shared_media_'.$i; }
        for ($i = 1; $i <= $this->maxInstallation; $i++) { $headings[] = 'installation_image_'.$i; }

        return $headings;
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $this->resolveSeries();
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

        foreach ($variants as $variant) {
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
            // Urutan kolom ikut template import: image_1..N, image_variation_*,
            // shared_media_*, installation_image_*. Jumlah kolom per series
            // mengikuti pemakaian dataset (minimal _1).
            for ($i = 1; $i <= $this->maxMain; $i++) {
                $row[] = $main[$i - 1] ?? null;
            }
            for ($slot = 0; $slot < $this->maxOptionSlots; $slot++) {
                $row[] = $optionImages[$slot] ?? null;
            }
            for ($i = 1; $i <= $this->maxShared; $i++) {
                $row[] = $shared[$i - 1] ?? null;
            }
            for ($i = 1; $i <= $this->maxInstallation; $i++) {
                $row[] = $installation[$i - 1] ?? null;
            }

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
