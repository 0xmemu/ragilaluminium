<?php

namespace App\Jobs;

use App\Models\MediaAsset;
use App\Models\MediaProcessingLog;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use App\Support\UrlGuard;
use App\Support\MediaFailureNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DownloadMediaAsset implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 180;

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
        if (! $asset || ! $asset->source_url || $asset->status === 'ready') {
            return;
        }

        $asset->update(['status' => 'downloading', 'error_reason' => null]);
        MediaProcessingLog::record($asset, 'processing', 'Mengunduh media dari URL sumber.');
        $tmp = null;

        try {
            UrlGuard::assertSafePublicUrl($asset->source_url, config('media.allowed_source_hosts', []));
            $tmp = tempnam(sys_get_temp_dir(), 'asset_');
            $response = Http::timeout((int) config('media.download_timeout', 60))
                ->withoutRedirecting()
                ->withOptions(['sink' => $tmp])
                ->get($asset->source_url);

            if (! $response->successful()) {
                if ($response->status() === 429 || $response->serverError()) {
                    throw new \RuntimeException('Sumber media sementara tidak tersedia (HTTP '.$response->status().').');
                }

                $this->failAsset($asset, 'HTTP '.$response->status());

                return;
            }

            $size = filesize($tmp) ?: 0;
            $maxBytes = $asset->kind === 'video'
                ? (int) config('media.max_video_bytes', 50 * 1024 * 1024)
                : (int) config('media.max_bytes', 10 * 1024 * 1024);
            if ($size > $maxBytes) {
                $this->failAsset($asset, "Ukuran file {$size}B melebihi batas {$maxBytes}B");

                return;
            }

            $mime = strtolower(explode(';', (string) ($response->header('Content-Type') ?: mime_content_type($tmp)))[0]);
            $allowedMime = $asset->kind === 'video'
                ? config('media.allowed_video_mime', [])
                : config('media.allowed_mime', []);
            if (! in_array($mime, $allowedMime, true)) {
                $this->failAsset($asset, "MIME tidak diizinkan: {$mime}");

                return;
            }

            $checksum = hash_file('sha256', $tmp);
            if (! is_string($checksum) || $checksum === '') {
                throw new \RuntimeException('Checksum asset gagal dibuat.');
            }

            $canonical = MediaAsset::where('checksum', $checksum)
                ->where('id', '!=', $asset->id)
                ->first();
            if ($canonical) {
                DB::transaction(function () use ($asset, $canonical): void {
                    ProductMedia::where('media_asset_id', $asset->id)
                        ->get()
                        ->each(function (ProductMedia $attachment) use ($canonical): void {
                            $duplicate = ProductMedia::query()
                                ->where('product_id', $attachment->product_id)
                                ->where('media_asset_id', $canonical->id)
                                ->when(
                                    $attachment->product_variant_id === null,
                                    fn ($query) => $query->whereNull('product_variant_id'),
                                    fn ($query) => $query->where('product_variant_id', $attachment->product_variant_id),
                                )
                                ->where('id', '!=', $attachment->id)
                                ->first();

                            if ($duplicate) {
                                $attachment->update(['visibility' => 'archived', 'status' => 'downloaded']);

                                return;
                            }

                            $attachment->update([
                                'media_asset_id' => $canonical->id,
                                'source_url' => $canonical->source_url,
                                'status' => $canonical->status === 'ready' ? 'downloaded' : 'pending',
                            ]);
                        });
                    $asset->update(['status' => 'archived', 'error_reason' => null]);
                });
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
                    'size_bytes' => $master ? Storage::disk(config('media.disk', 'media'))->size($master['path']) : $size,
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
            MediaProcessingLog::record($asset, 'success', 'Media berhasil diunduh dan derivatif WebP siap.');
        } catch (\Throwable $e) {
            $this->failAsset($asset, $e->getMessage());
            throw $e;
        } finally {
            if ($tmp && is_file($tmp)) {
                @unlink($tmp);
            }
        }
    }

    protected function failAsset(MediaAsset $asset, string $reason): void
    {
        $asset->update([
            'status' => 'failed',
            'error_reason' => Str::limit($reason, 500),
        ]);
        MediaProcessingLog::record($asset, 'failed', Str::limit($reason, 500));
        MediaFailureNotifier::notify($asset, $reason);
        ProductMedia::where('media_asset_id', $asset->id)->update([
            'status' => 'failed',
            'error_reason' => Str::limit($reason, 500),
        ]);
    }
}
