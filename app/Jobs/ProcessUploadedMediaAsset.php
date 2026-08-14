<?php

namespace App\Jobs;

use App\Models\CmsBanner;
use App\Models\CmsGalleryItem;
use App\Models\MediaAsset;
use App\Models\MediaProcessingLog;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use App\Support\MediaFailureNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Proses file yang sudah ter-upload langsung ke R2 (alur presigned upload):
 * baca object pending -> WebP thumb/card/pdp (atau simpan video) -> update
 * MediaAsset menjadi ready -> hapus object pending di R2.
 */
class ProcessUploadedMediaAsset implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    public array $backoff = [10, 60, 180];

    public function __construct(public int $assetId)
    {
        $this->onQueue('media');
    }

    public function uniqueId(): string
    {
        return (string) $this->assetId;
    }

    public function handle(MediaDerivativeService $derivatives): void
    {
        $asset = MediaAsset::find($this->assetId);
        if (! $asset || $asset->status === 'ready') {
            return;
        }

        MediaProcessingLog::record($asset, 'processing', 'Memulai proses derivatif WebP.');

        $disk = Storage::disk(config('media.disk', 'media'));
        $key = $asset->object_key;
        if (! $key || ! $disk->exists($key)) {
            $asset->update(['status' => 'failed', 'error_reason' => 'File upload tidak ditemukan di penyimpanan media.']);
            MediaProcessingLog::record($asset, 'failed', 'File upload tidak ditemukan di penyimpanan media.');
            MediaFailureNotifier::notify($asset, 'File upload tidak ditemukan di penyimpanan media.');

            return;
        }

        $tmp = null;
        try {
            $tmp = tempnam(sys_get_temp_dir(), 'uploaded_');
            if ($tmp === false) {
                throw new RuntimeException('Tidak dapat mengalokasikan file sementara.');
            }
            file_put_contents($tmp, $disk->get($key));

            $size = filesize($tmp) ?: 0;
            $maxBytes = $asset->kind === 'video'
                ? (int) config('media.max_video_bytes', 50 * 1024 * 1024)
                : (int) config('media.max_bytes', 10 * 1024 * 1024);
            if ($size > $maxBytes) {
                $asset->update(['status' => 'failed', 'error_reason' => "Ukuran file {$size}B melebihi batas {$maxBytes}B"]);
                MediaProcessingLog::record($asset, 'failed', "Ukuran file {$size}B melebihi batas {$maxBytes}B.");
                MediaFailureNotifier::notify($asset, "Ukuran file {$size}B melebihi batas {$maxBytes}B.");

                return;
            }

            $mime = strtolower((string) ($asset->mime_type ?: mime_content_type($tmp)));
            $allowedMime = $asset->kind === 'video'
                ? config('media.allowed_video_mime', [])
                : config('media.allowed_mime', []);
            if (! in_array($mime, $allowedMime, true)) {
                $asset->update(['status' => 'failed', 'error_reason' => "MIME tidak diizinkan: {$mime}"]);
                MediaProcessingLog::record($asset, 'failed', "MIME tidak diizinkan: {$mime}.");
                MediaFailureNotifier::notify($asset, "MIME tidak diizinkan: {$mime}.");

                return;
            }

            $checksum = hash_file('sha256', $tmp);
            if (! is_string($checksum) || $checksum === '') {
                throw new RuntimeException('Checksum media gagal dibuat.');
            }

            // Deduplikasi: file identik sudah ada -> arahkan attachment ke asset canonical.
            $canonical = MediaAsset::where('checksum', $checksum)
                ->where('id', '!=', $asset->id)
                ->first();
            if ($canonical) {
                DB::transaction(function () use ($asset, $canonical): void {
                    ProductMedia::where('media_asset_id', $asset->id)
                        ->get()
                        ->each(function (ProductMedia $attachment) use ($canonical): void {
                            $attachment->update([
                                'media_asset_id' => $canonical->id,
                                'source_url' => $canonical->source_url,
                                'status' => $canonical->status === 'ready' ? 'downloaded' : 'pending',
                            ]);
                        });
                    CmsBanner::where('media_asset_id', $asset->id)->update([
                        'media_asset_id' => $canonical->id,
                        'image_url' => $canonical->localUrlFor('pdp') ?: $canonical->localUrlFor('card') ?: $canonical->object_key,
                    ]);
                    CmsGalleryItem::where('media_asset_id', $asset->id)->update([
                        'media_asset_id' => $canonical->id,
                        'image_url' => $canonical->localUrlFor('pdp') ?: $canonical->localUrlFor('card') ?: $canonical->object_key,
                    ]);
                    $asset->update(['status' => 'archived', 'error_reason' => null]);
                });
                $disk->delete($key);
                MediaProcessingLog::record($asset, 'dedup', 'File identik dengan aset lain; diarsipkan dan attachment dialihkan.');

                return;
            }

            if ($asset->kind === 'video') {
                $stored = $derivatives->storeVideoAsset($tmp, $checksum, $mime);
                $asset->update([
                    'checksum' => $checksum,
                    'object_key' => $stored['path'],
                    'derivatives' => null,
                    'mime_type' => $stored['mime_type'],
                    'size_bytes' => $stored['size_bytes'],
                    'status' => 'ready',
                    'error_reason' => null,
                ]);
            } else {
                $dimensions = @getimagesize($tmp);
                $built = $derivatives->storeAssetDerivatives($tmp, $checksum);
                $master = $derivatives->masterDerivative($built);

                $asset->update([
                    'checksum' => $checksum,
                    'object_key' => $master['path'] ?? null,
                    'derivatives' => $built,
                    'mime_type' => 'image/webp',
                    'size_bytes' => $master ? $disk->size($master['path']) : $size,
                    'width_px' => $master['width'] ?? ($dimensions[0] ?? null),
                    'height_px' => $master['height'] ?? ($dimensions[1] ?? null),
                    'status' => 'ready',
                    'error_reason' => null,
                ]);
            }

            ProductMedia::where('media_asset_id', $asset->id)->update([
                'status' => 'downloaded',
                'error_reason' => null,
            ]);
            MediaProcessingLog::record($asset, 'success', 'Derivatif WebP siap (thumb/card/pdp).');

            // Banner promo & galeri hasil pemasangan: alihkan ke derivatif WebP.
            $pdpUrl = $asset->localUrlFor('pdp') ?: $asset->localUrlFor('card') ?: $asset->localUrlFor('thumb') ?: $asset->object_key;
            CmsBanner::where('media_asset_id', $asset->id)->update(['image_url' => $pdpUrl]);
            CmsGalleryItem::where('media_asset_id', $asset->id)->update(['image_url' => $pdpUrl]);

            // Object pending sudah dipindah ke derivatif; bersihkan yang tersisa.
            if ($disk->exists($key)) {
                $disk->delete($key);
            }
        } catch (\Throwable $e) {
            $reason = mb_substr($e->getMessage(), 0, 500);
            $asset->update(['status' => 'failed', 'error_reason' => $reason]);
            MediaProcessingLog::record($asset, 'failed', $reason);
            MediaFailureNotifier::notify($asset, $reason);
            throw $e;
        } finally {
            if ($tmp !== null) {
                @unlink($tmp);
            }
        }
    }
}
