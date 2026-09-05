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
 * Update Media.
 *
 * Kontrak media_update: variant_sku KOSONG = media level produk (berlaku
 * untuk semua varian), variant_sku TERISI = media khusus varian itu.
 *
 * Karena media di sistem ini tersimpan di LEVEL PRODUK (anti-duplikat),
 * sheet ini menghasilkan:
 *  - 1 baris per PRODUK (variant_sku kosong) berisi image_1..9 +
 *    installation_image_1..9 dari media level produk. Ini baris yang
 *    benar-benar berguna bagi admin.
 *  - + 1 baris per VARIAN yang benar-benar punya media varian-level
 *    (jarang; form manual lama). Baris tanpa satu pun URL TIDAK dibuat
 *    (percuma untuk admin, dan verifier akan melewatkannya).
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

        // 1. Baris level produk (variant_sku kosong): media yang dipakai
        //    semua varian. Inilah baris utama yang admin edit.
        $productRow = $this->buildMediaRow($product->parent_sku, null, $product->media);
        if ($productRow !== null) {
            $rows[] = $productRow;
        }

        // 2. Baris varian HANYA untuk varian yang punya media varian-level.
        foreach ($product->variants->where('status', 'active') as $variant) {
            $variantRow = $this->buildMediaRow($product->parent_sku, $variant->variant_sku, $product->media, $variant->id);
            if ($variantRow !== null) {
                $rows[] = $variantRow;
            }
        }

        return $rows;
    }

    /**
     * Bangun satu baris media. Return null bila tidak ada satu pun URL
     * (baris kosong tidak dibuat: percuma bagi admin).
     *
     * @param  \Illuminate\Support\Collection<int, mixed>  $allMedia
     * @return list<mixed>|null
     */
    protected function buildMediaRow(string $parentSku, ?string $variantSku, $allMedia, ?int $variantId = null): ?array
    {
        $media = $allMedia
            ->filter(fn ($m) => $variantId === null
                ? $m->product_variant_id === null
                : $m->product_variant_id === $variantId)
            ->sortBy('position')
            ->values();

        if ($media->isEmpty()) {
            return null;
        }

        $images = [];
        $installationImages = [];
        $installationSlots = [];
        $catalogPos = 0;
        $installPos = 0;

        foreach ($media as $m) {
            $url = (string) ($m->stored_url ?? $m->source_url ?? '');
            if ($url === '') { continue; }
            if ($m->is_installation) {
                $installPos++;
                if ($installPos <= 9) { $installationImages[$installPos - 1] = $url; }
                if ($m->show_in_catalog) {
                    // Slot image_N yang juga installation (kontrak template:
                    // installation_slots menunjuk posisi image_N).
                    $catalogSlot = 0;
                    foreach ($media as $m2) {
                        if ($m2->is_installation || ! $m2->show_in_catalog) { continue; }
                        $catalogSlot++;
                        if ($m2->id === $m->id) { $installationSlots[] = $catalogSlot; break; }
                    }
                }
            } elseif ($m->show_in_catalog) {
                $catalogPos++;
                if ($catalogPos <= 9) { $images[$catalogPos - 1] = $url; }
            }
        }

        if ($images === [] && $installationImages === []) {
            return null;
        }

        $row = [$parentSku, $variantSku];
        for ($i = 0; $i < 9; $i++) { $row[] = $images[$i] ?? null; }
        for ($i = 0; $i < 9; $i++) { $row[] = $installationImages[$i] ?? null; }
        $row[] = $installationSlots !== [] ? implode(',', array_unique($installationSlots)) : null;

        return array_map([ExportSafety::class, 'cell'], $row);
    }
}
