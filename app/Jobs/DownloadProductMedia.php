<?php

namespace App\Jobs;

use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use App\Support\UrlGuard;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DownloadProductMedia implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 180;

    public array $backoff = [10, 60, 180];

    public function __construct(public int $mediaId)
    {
        $this->onQueue('media');
    }

    public function uniqueId(): string
    {
        return (string) $this->mediaId;
    }

    public function handle(MediaDerivativeService $derivatives): void
    {
        $media = ProductMedia::find($this->mediaId);

        if (! $media || ! $media->source_url) {
            return;
        }

        // Sudah ada file + turunan — skip.
        if ($media->status === 'downloaded' && $media->stored_path && ! empty($media->derivatives)) {
            return;
        }

        // File sudah ada, hanya butuh turunan (retry / backfill).
        if ($media->status === 'downloaded' && $media->stored_path && empty($media->derivatives)) {
            try {
                $built = $derivatives->regenerateFromStored($media->stored_path, (int) $media->product_id);
                $payload = [
                    'derivatives' => $built,
                    'error_reason' => null,
                ];
                $promoted = $derivatives->promoteMasterAndDiscardOriginal($media->stored_path, $built);
                if ($promoted !== null) {
                    $payload = array_merge($payload, $promoted);
                }
                $media->update($payload);
            } catch (\Throwable $e) {
                $this->fail($media, $e->getMessage());
            }

            return;
        }

        $media->update(['status' => 'downloading']);

        $tmp = null;

        try {
            UrlGuard::assertSafePublicUrl($media->source_url, config('media.allowed_source_hosts', []));

            $tmp = tempnam(sys_get_temp_dir(), 'media_');
            $response = Http::timeout((int) config('media.download_timeout', 60))
                ->withOptions(['sink' => $tmp])
                ->get($media->source_url);

            if (! $response->successful()) {
                $this->fail($media, 'HTTP '.$response->status());

                return;
            }

            $size = filesize($tmp) ?: 0;
            $maxBytes = (int) config('media.max_bytes', 10 * 1024 * 1024);
            if ($size > $maxBytes) {
                $this->fail($media, "Ukuran file {$size}B melebihi batas {$maxBytes}B");

                return;
            }

            $mime = $response->header('Content-Type') ?: mime_content_type($tmp);
            $mimeBase = strtolower(explode(';', (string) $mime)[0]);
            $allowedMime = config('media.allowed_mime', []);
            if (! empty($allowedMime) && ! in_array($mimeBase, $allowedMime, true)) {
                $this->fail($media, "MIME tidak diizinkan: {$mime}");

                return;
            }

            $ext = $this->extensionFor($media->source_url, $mime);
            $basename = Str::random(16);
            $originalPath = "products/{$media->product_id}/{$basename}.{$ext}";
            $disk = Storage::disk(config('media.disk', 'media'));

            $dimensions = @getimagesize($tmp);
            $built = [];
            try {
                $built = $derivatives->storeDerivatives($tmp, (int) $media->product_id, $basename);
            } catch (\Throwable $e) {
                report($e);
            }

            $payload = [
                'derivatives' => $built ?: null,
                'status' => 'downloaded',
                'error_reason' => empty($built) ? Str::limit('derivatives_failed: check GD / image format', 500) : null,
            ];

            $promoted = ! empty($built)
                ? $derivatives->promoteMasterAndDiscardOriginal(null, $built)
                : null;

            if ($promoted !== null) {
                // Efisien: hanya WebP di disk; original tetap di source_url bila perlu unduh ulang.
                $payload = array_merge($payload, $promoted);
            } else {
                // Simpan original bila keep_original=true ATAU derivative gagal (fallback tampilan).
                $disk->put($originalPath, fopen($tmp, 'r'), ['visibility' => 'public']);
                $payload['stored_path'] = $originalPath;
                $payload['stored_url'] = $disk->url($originalPath);
                $payload['mime_type'] = $mimeBase ?: $mime;
                $payload['size_bytes'] = $size;
                $payload['width_px'] = $dimensions[0] ?? null;
                $payload['height_px'] = $dimensions[1] ?? null;
            }

            $media->update($payload);
        } catch (\Throwable $e) {
            $this->fail($media, $e->getMessage());
        } finally {
            if ($tmp && is_file($tmp)) {
                @unlink($tmp);
            }
        }
    }

    protected function fail(ProductMedia $media, string $reason): void
    {
        $media->update(['status' => 'failed', 'error_reason' => Str::limit($reason, 500)]);
    }

    protected function extensionFor(string $url, ?string $mime): string
    {
        $map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
        if ($mime && isset($map[strtolower(explode(';', $mime)[0])])) {
            return $map[strtolower(explode(';', $mime)[0])];
        }

        $ext = strtolower(Str::afterLast(parse_url($url, PHP_URL_PATH) ?: '', '.'));

        return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true) ? $ext : 'jpg';
    }
}
