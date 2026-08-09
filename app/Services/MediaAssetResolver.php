<?php

namespace App\Services;

use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

final class MediaAssetResolver
{
    public function fromSourceUrl(string $url, string $kind = 'image', ?int $userId = null, ?int $jobId = null): MediaAsset
    {
        $kind = in_array($kind, ['image', 'video'], true) ? $kind : 'image';
        $normalized = $this->normalizeUrl($url);
        $hash = hash('sha256', $normalized);

        return MediaAsset::firstOrCreate(
            ['source_url_hash' => $hash],
            [
                'kind' => $kind,
                'source_url' => $url,
                'status' => 'pending',
                'visibility' => 'visible',
                'created_by_user_id' => $userId,
                'created_by_import_job_id' => $jobId,
            ],
        );
    }

    public function fromUploadedImage(UploadedFile $file, ?int $userId = null): MediaAsset
    {
        return $this->fromUploadedFile($file, 'image', $userId);
    }

    public function fromUploadedFile(UploadedFile $file, string $kind = 'image', ?int $userId = null): MediaAsset
    {
        $kind = in_array($kind, ['image', 'video'], true) ? $kind : 'image';
        $tmp = $file->getRealPath();
        if (! $tmp || ! is_file($tmp)) {
            throw new RuntimeException('Berkas media tidak dapat dibaca.');
        }

        $maxBytes = $kind === 'video'
            ? (int) config('media.max_video_bytes')
            : (int) config('media.max_bytes');
        if (($file->getSize() ?: 0) > $maxBytes) {
            throw new RuntimeException('Ukuran file media melebihi batas yang diizinkan.');
        }

        $mime = strtolower((string) ($file->getMimeType() ?: mime_content_type($tmp)));
        $allowed = $kind === 'video' ? config('media.allowed_video_mime', []) : config('media.allowed_mime', []);
        if (! in_array($mime, $allowed, true)) {
            throw new RuntimeException('Tipe file media tidak diizinkan.');
        }

        $checksum = hash_file('sha256', $tmp);
        if (! is_string($checksum) || $checksum === '') {
            throw new RuntimeException('Checksum media gagal dibuat.');
        }

        $existing = MediaAsset::where('checksum', $checksum)->first();
        if ($existing) {
            return $existing;
        }

        $asset = MediaAsset::create([
            'kind' => $kind,
            'label' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            'checksum' => $checksum,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
            'status' => 'downloading',
            'visibility' => 'visible',
            'created_by_user_id' => $userId,
        ]);

        try {
            $derivativeService = app(MediaDerivativeService::class);
            if ($kind === 'video') {
                $stored = $derivativeService->storeVideoAsset($tmp, $checksum, $mime);
                $asset->update([
                    'object_key' => $stored['path'],
                    'derivatives' => null,
                    'mime_type' => $stored['mime_type'],
                    'size_bytes' => $stored['size_bytes'],
                    'status' => 'ready',
                    'error_reason' => null,
                ]);
            } else {
                $derivatives = $derivativeService->storeAssetDerivatives($tmp, $checksum);
                $master = $derivativeService->masterDerivative($derivatives);
                $asset->update([
                    'object_key' => $master['path'] ?? null,
                    'derivatives' => $derivatives,
                    'mime_type' => 'image/webp',
                    'size_bytes' => $master ? Storage::disk(config('media.disk', 'media'))->size($master['path']) : $file->getSize(),
                    'width_px' => $master['width'] ?? null,
                    'height_px' => $master['height'] ?? null,
                    'status' => 'ready',
                    'error_reason' => null,
                ]);
            }
        } catch (\Throwable $e) {
            $asset->update(['status' => 'failed', 'error_reason' => Str::limit($e->getMessage(), 500)]);
            throw $e;
        }

        return $asset->fresh();
    }

    public function attach(
        Product $product,
        MediaAsset $asset,
        array $attributes = [],
        ?int $userId = null,
        ?int $jobId = null,
    ): ProductMedia {
        $query = ProductMedia::query()
            ->where('product_id', $product->id)
            ->where('media_asset_id', $asset->id);

        if (array_key_exists('product_variant_id', $attributes) && $attributes['product_variant_id'] !== null) {
            $query->where('product_variant_id', $attributes['product_variant_id']);
        } else {
            $query->whereNull('product_variant_id');
        }

        $media = $query->first() ?? new ProductMedia([
            'product_id' => $product->id,
            'media_asset_id' => $asset->id,
            'product_variant_id' => $attributes['product_variant_id'] ?? null,
            'source_url' => $asset->source_url,
            'created_by_user_id' => $userId,
            'created_by_import_job_id' => $jobId,
        ]);

        $media->fill([
            'media_asset_id' => $asset->id,
            'source_url' => $asset->source_url,
            'position' => $attributes['position'] ?? ($media->position ?: 1),
            'is_main_image' => (bool) ($attributes['is_main_image'] ?? $media->is_main_image),
            'show_in_catalog' => (bool) ($attributes['show_in_catalog'] ?? true),
            'is_installation' => (bool) ($attributes['is_installation'] ?? false),
            'installation_caption' => $attributes['installation_caption'] ?? $media->installation_caption,
            'visibility' => $attributes['visibility'] ?? 'visible',
            'status' => $asset->status === 'ready' ? 'downloaded' : 'pending',
            'last_updated_by_import_job_id' => $jobId,
            'updated_by_user_id' => $userId,
        ]);
        $media->save();

        if ($media->is_main_image) {
            ProductMedia::where('product_id', $product->id)
                ->where('id', '!=', $media->id)
                ->update(['is_main_image' => false]);
        }

        return $media->fresh(['mediaAsset']);
    }

    public function normalizeUrl(string $url): string
    {
        $parts = parse_url(trim($url));
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return trim($url);
        }

        $normalized = strtolower($parts['scheme']).'://'.strtolower($parts['host']);
        if (! empty($parts['port'])) {
            $normalized .= ':'.$parts['port'];
        }
        $normalized .= $parts['path'] ?? '/';

        if (! empty($parts['query'])) {
            parse_str($parts['query'], $query);
            ksort($query);
            $normalized .= '?'.http_build_query($query);
        }

        return $normalized;
    }
}
