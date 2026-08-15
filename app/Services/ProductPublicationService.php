<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Validation\ValidationException;

final class ProductPublicationService
{
    /**
     * Return the publish checklist used by both the API and the admin review UI.
     *
     * @return array<string, bool|array<int, string>>
     */
    public function completion(Product $product): array
    {
        $product->loadMissing(['variants', 'attributes', 'media']);

        $activeVariants = $product->variants->where('status', 'active');
        $hasActiveVariants = $activeVariants->isNotEmpty();
        $hasPrices = $hasActiveVariants && $activeVariants->every(
            fn ($variant): bool => (float) $variant->price > 0
        );
        $readyMedia = $product->media->filter(fn ($media): bool =>
            $media->show_in_catalog
            && $media->visibility === 'visible'
            && in_array($media->status, ['downloaded', 'ready'], true)
        );
        $hasReadyMainImage = $readyMedia->contains(
            fn ($media): bool => $media->is_main_image
        );
        $activeVariantIds = $activeVariants->pluck('id');
        $hasPhotoCoverage = $activeVariantIds->isNotEmpty()
            && $readyMedia->contains(
                fn ($media): bool => $media->product_variant_id !== null
                    && $activeVariantIds->contains($media->product_variant_id)
            );
        $hasSpecifications = $product->attributes->contains(
            fn ($attribute): bool => trim((string) $attribute->attribute_name) !== ''
                && trim((string) $attribute->attribute_value) !== ''
        );
        $hasExplanation = trim((string) $product->description) !== '';
        $hasShippingData = $hasActiveVariants && $activeVariants->every(
            fn ($variant): bool => (float) $variant->weight_kg > 0
                && (float) $variant->width_cm > 0
                && (float) $variant->height_cm > 0
                && (float) $variant->depth_cm > 0
        );

        return [
            'active_variants' => $hasActiveVariants,
            'prices' => $hasPrices,
            'main_image_ready' => $hasReadyMainImage,
            'photo_coverage' => $hasPhotoCoverage,
            'missing_colors' => [],
            'specifications' => $hasSpecifications,
            'explanation' => $hasExplanation,
            'shipping_data' => $hasShippingData,
        ];
    }

    public function publish(Product $product, int $userId): void
    {
        $completion = $this->completion($product);
        $errors = [];

        if (! $completion['active_variants']) {
            $errors['variants'] = 'Tambahkan minimal satu varian aktif sebelum diaktifkan.';
        }

        if (! $completion['prices']) {
            $errors['prices'] = 'Setiap varian aktif harus memiliki harga manual lebih dari nol.';
        }

        if (! $completion['main_image_ready']) {
            $errors['media'] = 'Atur satu gambar utama katalog yang sudah selesai diproses.';
        }

        if (! $completion['photo_coverage']) {
            $errors['photo_coverage'] = 'Pasang minimal satu foto siap pada grup/varian produk.';
        }

        if (! $completion['specifications']) {
            $errors['specifications'] = 'Tambahkan minimal satu spesifikasi produk.';
        }

        if (! $completion['explanation']) {
            $errors['explanation'] = 'Isi penjelasan/deskripsi produk.';
        }

        if (! $completion['shipping_data']) {
            $errors['shipping_data'] = 'Lengkapi berat, lebar, tinggi, dan tebal pada setiap varian aktif.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $product->update([
            'status' => 'active',
            'updated_by_user_id' => $userId,
        ]);
    }
}
