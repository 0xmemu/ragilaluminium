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
 * Sheet paste-ready "Update Harga & Stok": kolom & urutan IDENTIK dengan
 * sheet Data template import katalog (CatalogTemplateExport::dataHeaders()).
 *
 * Matriks mengikuti template import, BUKAN dikarang: identitas produk,
 * harga per kombinasi varian, stok, dimensi, gambar per opsi, shared media,
 * installation. Bagian yang tidak relevan untuk update tetap diisi dari DB
 * supaya baris bisa di-paste langsung dan diverifikasi.
 *
 * Satu baris = satu kombinasi varian (sesuai semantik template: kolom
 * kombinasi menandai baris varian jadi). id_key = SKU produk (stabil,
 * bukan nomor sesi karena ini file rujukan, bukan file import baru).
 */
class ProductExportUpdatePriceStockSheet extends RagilStyledExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(protected Builder $query)
    {
        $this->sheetTitle = 'Update Harga & Stok';
        $this->columnWidths = array_merge(
            ['A' => 14, 'B' => 34, 'C' => 40],
            array_fill_keys(['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL'], 18)
        );
        $this->currencyColumns = ['S'];
    }

    public function query(): Builder
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        return $this->query->with(['variants']);
    }

    public function headings(): array
    {
        // Persis header template import katalog (matriks yang sama).
        return CatalogTemplateExport::dataHeaders();
    }

    /** @return list<array<int, mixed>> */
    public function map($product): array
    {
        $headers = CatalogTemplateExport::dataHeaders();
        $rows = [];

        $variants = $product->variants->sortBy('id')->values();

        foreach ($variants as $index => $variant) {
            $row = array_fill(0, count($headers), null);

            foreach ($headers as $col => $header) {
                $row[$col] = match ($header) {
                    // Identitas: cukup di baris pertama grup (baris pertama
                    // varian); baris lanjutan hanya kombinasi + harga + stok.
                    'id_key' => $index === 0 ? $product->parent_sku : null,
                    'name' => $index === 0 ? $product->name : null,
                    'description' => $index === 0 ? $product->description : null,
                    'product_category' => $index === 0 ? $product->product_category : null,
                    'product_model' => $index === 0 ? $product->product_model : null,
                    'design_variant' => $index === 0 ? $product->design_variant : null,
                    // Definisi opsi: di baris pertama grup (sama seperti file import).
                    'variation_1_name' => $index === 0 ? $variant->variation_1_name : null,
                    'variation_1_option_1' => $index === 0 ? $this->optionAt($variant->variation_1_option, 0) : null,
                    'variation_1_option_2' => $index === 0 ? $this->optionAt($variant->variation_1_option, 1) : null,
                    'variation_1_option_3' => $index === 0 ? $this->optionAt($variant->variation_1_option, 2) : null,
                    'variation_1_option_4' => $index === 0 ? $this->optionAt($variant->variation_1_option, 3) : null,
                    'variation_2_name' => $index === 0 ? $variant->variation_2_name : null,
                    'variation_2_option_1' => $index === 0 ? $this->optionAt($variant->variation_2_option, 0) : null,
                    'variation_2_option_2' => $index === 0 ? $this->optionAt($variant->variation_2_option, 1) : null,
                    'variation_2_option_3' => $index === 0 ? $this->optionAt($variant->variation_2_option, 2) : null,
                    'variation_2_option_4' => $index === 0 ? $this->optionAt($variant->variation_2_option, 3) : null,
                    // Kombinasi + harga + stok: di SEMUA baris (inti update).
                    'variantion_combination', 'variation_combination' => $this->combination($variant),
                    'price_variantion_combination' => (float) $variant->price,
                    'stock' => (int) $variant->stock,
                    // Dimensi pengiriman: milik produk (ADR-021), baris pertama.
                    'weight_kg' => $index === 0 ? (float) $product->weight_kg : null,
                    'height_cm' => $index === 0 ? (float) $product->height_cm : null,
                    'width_cm' => $index === 0 ? (float) $product->width_cm : null,
                    'depth_cm' => $index === 0 ? (float) $product->depth_cm : null,
                    // Media & spec: tidak diisi di sheet ini (lihat sheet Update
                    // Media dan Atribut). Kolom tetap ada supaya header identik.
                    default => null,
                };
            }

            $rows[] = array_map([ExportSafety::class, 'cell'], $row);
        }

        return $rows;
    }

    protected function optionAt(?string $option, int $index): ?string
    {
        // Definisi opsi produk dari varian tunggal: varian pertama memegang
        // satu opsi terpilih; opsi lengkap milik produk. Untuk file update,
        // cukup opsi terpilih di slot pertama; opsi lain biarkan kosong agar
        // tidak mengubah definisi varian saat di-paste.
        return $index === 0 ? $option : null;
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
