<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Validation\ValidationException;

final class ProductPublicationService
{
    public function publish(Product $product, int $userId): void
    {
        $product->loadMissing(['variants', 'media']);

        $errors = [];

        if (! $product->variants->contains(fn ($variant) => $variant->status === 'active')) {
            $errors['product'] = 'Tambahkan minimal satu varian aktif sebelum dipublikasikan.';
        }

        $hasReadyMainImage = $product->media->contains(fn ($media) =>
            $media->is_main_image
            && $media->show_in_catalog
            && $media->visibility === 'visible'
            && $media->status === 'downloaded'
        );

        if (! $hasReadyMainImage) {
            $errors['product'] = ($errors['product'] ?? '')
                .' Atur satu gambar utama katalog yang sudah selesai diproses.';
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
