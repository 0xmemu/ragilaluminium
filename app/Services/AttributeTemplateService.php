<?php

namespace App\Services;

use App\Models\Product;
use App\Models\SubModel;
use App\Models\SubModelAttributeTemplate;

/**
 * Template atribut per sub model (dengan fallback template default model).
 *
 * Aturan keputusan (ADR-019):
 *  - Template menempel ke sub_model_id (per desain/sub model produk).
 *  - Bila sub model belum punya template -> gunakan template default model
 *    (sub_model_id null, product_model sama).
 *  - Hanya mengisi produk yang BELUM punya atribut (tidak pernah menimpa).
 *  - Sumber atribut selalu 'internal'.
 */
class AttributeTemplateService
{
    /** Resolusi template: desain dulu, lalu default model. */
    public function resolve(string $productModel, ?string $designCode): \Illuminate\Support\Collection
    {
        $designCode = trim((string) $designCode);

        if ($designCode !== '' && $designCode !== '0') {
            $subModel = SubModel::query()
                ->where('product_model', $productModel)
                ->where('code', $designCode)
                ->first();

            if ($subModel !== null) {
                $rows = SubModelAttributeTemplate::query()
                    ->where('is_active', true)
                    ->where('sub_model_id', $subModel->id)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get();

                if ($rows->isNotEmpty()) {
                    return $rows;
                }
            }
        }

        return SubModelAttributeTemplate::query()
            ->where('is_active', true)
            ->whereNull('sub_model_id')
            ->where('product_model', $productModel)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    /** Terapkan template ke produk bila kosong; kembalikan jumlah atribut yang dibuat. */
    public function applyToProduct(Product $product): int
    {
        if ($product->attributes()->exists()) {
            return 0;
        }

        $rows = $this->resolve($product->product_model, $product->design_variant);
        if ($rows->isEmpty()) {
            return 0;
        }

        foreach ($rows as $row) {
            $product->attributes()->create([
                'attribute_name' => $row->attribute_name,
                'attribute_value' => $row->attribute_value,
                'source' => 'internal',
            ]);
        }

        return $rows->count();
    }
}
