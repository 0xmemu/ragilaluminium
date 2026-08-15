<?php

namespace App\Services;

use App\Models\Product;

final class ImportedProductActivationService
{
    /**
     * Apply the same completeness gate used by the admin publish workflow.
     *
     * Imports never create a draft state: incomplete products are archived with
     * machine-readable reasons recorded on the import row.
     *
     * @return array{status: string, reasons: array<int, string>, completion: array<string, mixed>}
     */
    public function apply(Product $product): array
    {
        $completion = app(ProductPublicationService::class)->completion($product->fresh());
        $labels = [
            'active_variants' => 'varian aktif',
            'prices' => 'harga setiap varian',
            'main_image_ready' => 'gambar utama siap',
            'photo_coverage' => 'cakupan foto varian',
            'specifications' => 'spesifikasi',
            'explanation' => 'penjelasan produk',
            'shipping_data' => 'data pengiriman (berat dan dimensi packing > 0)',
        ];
        $reasons = [];

        foreach ($labels as $key => $label) {
            if (! ($completion[$key] ?? false)) {
                $reasons[] = $label;
            }
        }

        $status = $reasons === [] ? 'active' : 'archived';
        $product->forceFill(['status' => $status])->save();

        return [
            'status' => $status,
            'reasons' => $reasons,
            'completion' => $completion,
        ];
    }
}
