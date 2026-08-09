<?php

namespace App\Console\Commands;

use App\Jobs\DownloadMediaAsset;
use App\Models\MediaAsset;
use App\Models\ProductMedia;
use App\Services\MediaAssetResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackfillMediaAssets extends Command
{
    protected $signature = 'media:backfill-assets
                            {--dry-run : Report candidates without writing rows}
                            {--limit=0 : Maximum number of attachments to inspect}
                            {--queue : Queue remote source downloads after linking}
                            {--repair-linked : Hydrate already-linked assets from existing legacy files}';

    protected $description = 'Link legacy product_media rows to shared media_assets without deleting files or rows';

    public function handle(MediaAssetResolver $resolver): int
    {
        $query = ProductMedia::query()->whereNull('media_asset_id')->orderBy('id');
        $limit = max(0, (int) $this->option('limit'));
        $processed = $linked = $failed = 0;
        $disk = Storage::disk(config('media.disk', 'media'));

        $query->when($limit > 0, fn ($builder) => $builder->limit($limit))
            ->chunkById(100, function ($rows) use ($resolver, $disk, $limit, &$processed, &$linked, &$failed): bool {
                foreach ($rows as $media) {
                    if ($limit > 0 && $processed >= $limit) {
                        return false;
                    }
                    $processed++;
                    if ($this->option('dry-run')) {
                        $this->line("would link product_media #{$media->id}");
                        continue;
                    }

                    try {
                        $asset = $this->assetFromLegacyStorage($media, $disk)
                            ?? ($media->source_url
                                ? $resolver->fromSourceUrl(
                                    (string) $media->source_url,
                                    $this->kindFor($media),
                                    $media->created_by_user_id,
                                    $media->created_by_import_job_id,
                                )
                                : null);
                        if (! $asset) {
                            throw new \RuntimeException('Legacy media tidak memiliki file atau source URL.');
                        }

                        $media->update([
                            'media_asset_id' => $asset->id,
                            'status' => $asset->status === 'ready' ? 'downloaded' : $media->status,
                            'error_reason' => $asset->error_reason,
                        ]);
                        $linked++;

                        if ($this->option('queue') && $asset->status === 'pending') {
                            DownloadMediaAsset::dispatch($asset->id);
                        }
                    } catch (\Throwable $e) {
                        $failed++;
                        $this->warn("product_media #{$media->id}: {$e->getMessage()}");
                    }
                }
                return true;
            });

        if ($this->option('repair-linked')) {
            ProductMedia::query()
                ->whereNotNull('media_asset_id')
                ->with('mediaAsset')
                ->orderBy('id')
                ->when($limit > 0, fn ($builder) => $builder->limit($limit))
                ->chunkById(100, function ($rows) use ($disk, $limit, &$processed, &$linked, &$failed): bool {
                    foreach ($rows as $media) {
                        if ($limit > 0 && $processed >= $limit) {
                            return false;
                        }
                        $processed++;
                        if ($this->option('dry-run')) {
                            $this->line("would repair product_media #{$media->id}");
                            continue;
                        }

                        try {
                            if (! $media->mediaAsset) {
                                throw new \RuntimeException('Shared asset tidak ditemukan.');
                            }
                            $this->hydrateAssetFromLegacy($media->mediaAsset, $media, $disk);
                            $linked++;
                        } catch (\Throwable $e) {
                            $failed++;
                            $this->warn("product_media #{$media->id}: {$e->getMessage()}");
                        }
                    }
                    return true;
                });
        }

        $this->info("Inspected: {$processed}; linked: {$linked}; failed: {$failed}.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    protected function assetFromLegacyStorage(ProductMedia $media, $disk): ?MediaAsset
    {
        $legacyPath = $media->stored_path;
        if (! $legacyPath) {
            $legacyPath = data_get($media->derivatives, 'pdp.path')
                ?: data_get($media->derivatives, 'card.path')
                ?: data_get($media->derivatives, 'thumb.path');
        }

        $exists = is_string($legacyPath) && $legacyPath !== '' && $disk->exists($legacyPath);
        if (! $exists) {
            return null;
        }

        $checksum = $exists ? hash('sha256', (string) $disk->get($legacyPath)) : null;
        $asset = $media->mediaAsset ?: ($checksum ? MediaAsset::where('checksum', $checksum)->first() : null);
        if (! $asset) {
            $asset = MediaAsset::create([
                'kind' => $this->kindFor($media),
                'label' => 'Legacy media #'.$media->id,
                'checksum' => $checksum,
                'object_key' => $legacyPath,
                'derivatives' => $media->derivatives,
                'source_url' => $media->source_url,
                'mime_type' => $media->mime_type,
                'size_bytes' => $media->size_bytes,
                'width_px' => $media->width_px,
                'height_px' => $media->height_px,
                'status' => 'ready',
                'visibility' => $media->visibility === 'archived' ? 'archived' : 'visible',
                'error_reason' => null,
                'created_by_import_job_id' => $media->created_by_import_job_id,
                'created_by_user_id' => $media->created_by_user_id,
            ]);
        }

        return $this->hydrateAssetFromLegacy($asset, $media, $disk, $checksum, $legacyPath);
    }

    protected function hydrateAssetFromLegacy(
        MediaAsset $asset,
        ProductMedia $media,
        $disk,
        ?string $checksum = null,
        ?string $legacyPath = null,
    ): MediaAsset {
        $legacyPath ??= $media->stored_path
            ?: data_get($media->derivatives, 'pdp.path')
            ?: data_get($media->derivatives, 'card.path')
            ?: data_get($media->derivatives, 'thumb.path');
        if (! is_string($legacyPath) || $legacyPath === '' || ! $disk->exists($legacyPath)) {
            return $asset;
        }

        $checksum ??= hash('sha256', (string) $disk->get($legacyPath));
        $checksumTaken = MediaAsset::query()
            ->where('checksum', $checksum)
            ->where('id', '!=', $asset->id)
            ->exists();
        $asset->update([
            'checksum' => $checksumTaken ? null : $checksum,
            'object_key' => $legacyPath,
            'derivatives' => $media->derivatives,
            'source_url' => $asset->source_url ?: $media->source_url,
            'mime_type' => $media->mime_type,
            'size_bytes' => $media->size_bytes,
            'width_px' => $media->width_px,
            'height_px' => $media->height_px,
            'status' => 'ready',
            'error_reason' => null,
        ]);

        return $asset->fresh();
    }

    protected function kindFor(ProductMedia $media): string
    {
        return str_starts_with(strtolower((string) $media->mime_type), 'video/') ? 'video' : 'image';
    }
}
