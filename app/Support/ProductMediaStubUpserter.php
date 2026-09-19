<?php

namespace App\Support;

use App\Jobs\DownloadMediaAsset;
use App\Models\ProductMedia;
use App\Services\MediaAssetResolver;

/**
 * Upsert stub media untuk import (katalog & update media). Satu sumber
 * logika: resolver MediaAssetResolver, idempoten per media_asset_id dan peran
 * (katalog/pemasangan), hanya menambah/memperbarui flag, TIDAK PERNAH menghapus.
 */
class ProductMediaStubUpserter
{
    public function __construct(protected int $jobId)
    {
    }

    public function upsert(
        int $productId,
        ?int $variantId,
        string $url,
        int $position,
        bool $isMain = false,
        bool $showInCatalog = true,
        bool $isInstallation = false,
    ): void {
        $asset = app(MediaAssetResolver::class)->fromSourceUrl($url, jobId: $this->jobId);
        $mediaQuery = ProductMedia::query()
            ->where('product_id', $productId)
            ->where('media_asset_id', $asset->id);

        // Pisahkan baris foto katalog vs hasil pemasangan: satu aset foto
        // boleh sekaligus dipakai di Foto Produk dan di Hasil Pemasangan
        // (selaras MediaAssetResolver::attach).
        $mediaQuery->where('is_installation', $isInstallation);
        if ($variantId === null) {
            $mediaQuery->whereNull('product_variant_id');
        } else {
            $mediaQuery->where('product_variant_id', $variantId);
        }
        $media = $mediaQuery->first() ?? new ProductMedia([
            'product_id' => $productId,
            'product_variant_id' => $variantId,
            'media_asset_id' => $asset->id,
            'source_url' => $url,
            'created_by_import_job_id' => $this->jobId,
        ]);

        $updates = [
            'last_updated_by_import_job_id' => $this->jobId,
            'media_asset_id' => $asset->id,
            'source_url' => $url,
            // Isi ulang via import adalah aksi eksplisit: baris yang pernah
            // diarsip lewat panel admin kembali tampil (audit P1-4).
            'visibility' => 'visible',
            'status' => $asset->status === 'ready' ? 'downloaded' : 'pending',
            // Posisi hanya diset saat baris baru; baris lama tidak digeser
            // oleh penulisan slot lain yang memakai aset sama (audit P2-7).
            'position' => $media->exists ? $media->position : $position,
            'is_main_image' => $showInCatalog && $isMain ? true : (bool) $media->is_main_image,
            'show_in_catalog' => $showInCatalog || (bool) $media->show_in_catalog,
            'is_installation' => $isInstallation || (bool) $media->is_installation,
        ];

        if ($updates['is_main_image']) {
            ProductMedia::where('product_id', $productId)
                ->where('id', '!=', $media->id)
                ->update(['is_main_image' => false]);
        }
        $media->fill($updates)->save();

        if ($asset->status === 'pending') {
            DownloadMediaAsset::dispatch($asset->id);
        }
    }
}