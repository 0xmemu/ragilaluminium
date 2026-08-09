<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Build WebP thumb / card / pdp derivatives with PHP GD (no Intervention dep).
 */
class MediaDerivativeService
{
    /**
     * @return array<string, array{path: string, url: string, width: int, height: int}>
     */
    public function storeDerivatives(string $absoluteSourcePath, int $productId, string $basename): array
    {
        if (! extension_loaded('gd')) {
            throw new RuntimeException('PHP GD extension is required to generate media derivatives.');
        }

        $sizes = config('media.derivatives', [
            'thumb' => 400,
            'card' => 800,
            'pdp' => 1400,
        ]);
        $quality = (int) config('media.webp_quality', 82);
        $disk = Storage::disk(config('media.disk', 'media'));

        $source = $this->loadImage($absoluteSourcePath);
        if ($source === false) {
            throw new RuntimeException('Unable to read image for derivatives.');
        }

        $srcW = imagesx($source);
        $srcH = imagesy($source);
        $out = [];

        foreach ($sizes as $name => $maxEdge) {
            $maxEdge = max(1, (int) $maxEdge);
            [$dstW, $dstH] = $this->fitWithin($srcW, $srcH, $maxEdge);

            $canvas = imagecreatetruecolor($dstW, $dstH);
            if ($canvas === false) {
                imagedestroy($source);
                throw new RuntimeException('Unable to allocate derivative canvas.');
            }

            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefilledrectangle($canvas, 0, 0, $dstW, $dstH, $transparent);
            imagealphablending($canvas, true);

            imagecopyresampled($canvas, $source, 0, 0, 0, 0, $dstW, $dstH, $srcW, $srcH);

            $tmp = tempnam(sys_get_temp_dir(), 'deriv_');
            if ($tmp === false || ! imagewebp($canvas, $tmp, $quality)) {
                imagedestroy($canvas);
                imagedestroy($source);
                throw new RuntimeException("Failed to encode WebP derivative [{$name}].");
            }
            imagedestroy($canvas);

            $path = "products/{$productId}/{$basename}-{$name}.webp";
            $disk->put($path, fopen($tmp, 'r'), ['visibility' => 'public']);
            @unlink($tmp);

            $out[$name] = [
                'path' => $path,
                'url' => $disk->url($path),
                'width' => $dstW,
                'height' => $dstH,
            ];
        }

        imagedestroy($source);

        return $out;
    }

    /**
     * Store immutable derivatives for a shared asset. The checksum is the
     * storage namespace so different products never create duplicate bytes.
     *
     * @return array<string, array{path: string, url: string, width: int, height: int}>
     */
    public function storeAssetDerivatives(string $absoluteSourcePath, string $checksum): array
    {
        if (! extension_loaded('gd')) {
            throw new RuntimeException('PHP GD extension is required to generate media derivatives.');
        }

        $sizes = config('media.derivatives', [
            'thumb' => 400,
            'card' => 800,
            'pdp' => 1400,
        ]);
        $quality = (int) config('media.webp_quality', 82);
        $disk = Storage::disk(config('media.disk', 'media'));
        $source = $this->loadImage($absoluteSourcePath);

        if ($source === false) {
            throw new RuntimeException('Unable to read image for shared asset derivatives.');
        }

        $srcW = imagesx($source);
        $srcH = imagesy($source);
        $out = [];

        foreach ($sizes as $name => $maxEdge) {
            [$dstW, $dstH] = $this->fitWithin($srcW, $srcH, max(1, (int) $maxEdge));
            $canvas = imagecreatetruecolor($dstW, $dstH);
            if ($canvas === false) {
                imagedestroy($source);
                throw new RuntimeException('Unable to allocate shared derivative canvas.');
            }

            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefilledrectangle($canvas, 0, 0, $dstW, $dstH, $transparent);
            imagealphablending($canvas, true);

            imagecopyresampled($canvas, $source, 0, 0, 0, 0, $dstW, $dstH, $srcW, $srcH);
            $tmp = tempnam(sys_get_temp_dir(), 'shared_deriv_');
            if ($tmp === false || ! imagewebp($canvas, $tmp, $quality)) {
                imagedestroy($canvas);
                imagedestroy($source);
                throw new RuntimeException("Failed to encode shared WebP derivative [{$name}].");
            }
            imagedestroy($canvas);

            $path = "media-assets/{$checksum}/{$name}.webp";
            $disk->put($path, fopen($tmp, 'r'), ['visibility' => 'public']);
            @unlink($tmp);
            $out[$name] = [
                'path' => $path,
                'url' => $disk->url($path),
                'width' => $dstW,
                'height' => $dstH,
            ];
        }

        imagedestroy($source);

        return $out;
    }

    /**
     * Store one browser-compatible video original in the immutable asset namespace.
     * Videos intentionally skip image derivatives and transcoding in this phase.
     *
     * @return array{path: string, url: string, mime_type: string, size_bytes: int}
     */
    public function storeVideoAsset(string $absoluteSourcePath, string $checksum, string $mimeType): array
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $extension = match ($mimeType) {
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
            default => 'mp4',
        };
        $path = "media-assets/{$checksum}/video.{$extension}";
        $stream = fopen($absoluteSourcePath, 'r');
        if ($stream === false || ! $disk->put($path, $stream, ['visibility' => 'public'])) {
            if (is_resource($stream)) {
                fclose($stream);
            }
            throw new RuntimeException('Unable to store video asset.');
        }
        fclose($stream);

        return [
            'path' => $path,
            'url' => $disk->url($path),
            'mime_type' => $mimeType,
            'size_bytes' => (int) ($disk->size($path) ?: filesize($absoluteSourcePath) ?: 0),
        ];
    }

    public function keepOriginal(): bool
    {
        return (bool) config('media.keep_original', false);
    }

    /**
     * Prefer pdp → card → thumb as the on-disk master when originals are discarded.
     *
     * @param  array<string, array{path: string, url: string, width: int, height: int}>  $derivatives
     * @return array{path: string, url: string, width: int, height: int, key: string}|null
     */
    public function masterDerivative(array $derivatives): ?array
    {
        foreach (['pdp', 'card', 'thumb'] as $key) {
            if (! empty($derivatives[$key]['path'])) {
                return [
                    'path' => (string) $derivatives[$key]['path'],
                    'url' => (string) ($derivatives[$key]['url'] ?? ''),
                    'width' => (int) ($derivatives[$key]['width'] ?? 0),
                    'height' => (int) ($derivatives[$key]['height'] ?? 0),
                    'key' => $key,
                ];
            }
        }

        return null;
    }

    /**
     * Drop a non-WebP original when keep_original=false and derivatives exist.
     *
     * @param  array<string, array{path: string, url: string, width: int, height: int}>  $derivatives
     * @return array{stored_path: string, stored_url: string, mime_type: string, size_bytes: int|null, width_px: int|null, height_px: int|null}|null
     */
    public function promoteMasterAndDiscardOriginal(?string $originalPath, array $derivatives): ?array
    {
        if ($this->keepOriginal() || $derivatives === []) {
            return null;
        }

        $master = $this->masterDerivative($derivatives);
        if ($master === null) {
            return null;
        }

        $disk = Storage::disk(config('media.disk', 'media'));
        if ($originalPath && $originalPath !== $master['path'] && $disk->exists($originalPath)) {
            $disk->delete($originalPath);
        }

        $size = null;
        if ($disk->exists($master['path'])) {
            $size = $disk->size($master['path']);
        }

        return [
            'stored_path' => $master['path'],
            'stored_url' => $master['url'] !== '' ? $master['url'] : $disk->url($master['path']),
            'mime_type' => 'image/webp',
            'size_bytes' => $size,
            'width_px' => $master['width'] > 0 ? $master['width'] : null,
            'height_px' => $master['height'] > 0 ? $master['height'] : null,
        ];
    }

    /**
     * Regenerate derivatives from a file already on the media disk.
     *
     * @return array<string, array{path: string, url: string, width: int, height: int}>
     */
    public function regenerateFromStored(string $storedPath, int $productId): array
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        if (! $disk->exists($storedPath)) {
            throw new RuntimeException("Stored media missing: {$storedPath}");
        }

        $tmp = tempnam(sys_get_temp_dir(), 'media_src_');
        if ($tmp === false) {
            throw new RuntimeException('Unable to allocate temp file.');
        }

        file_put_contents($tmp, $disk->get($storedPath));
        $basename = pathinfo($storedPath, PATHINFO_FILENAME) ?: Str::random(12);
        $basename = (string) preg_replace('/-(thumb|card|pdp)$/', '', $basename);
        if ($basename === '') {
            $basename = Str::random(12);
        }

        try {
            return $this->storeDerivatives($tmp, $productId, $basename);
        } finally {
            @unlink($tmp);
        }
    }

    /** @return \GdImage|resource|false */
    protected function loadImage(string $path)
    {
        $info = @getimagesize($path);
        if ($info === false) {
            return false;
        }

        return match ($info[2] ?? null) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG => @imagecreatefrompng($path),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            IMAGETYPE_GIF => @imagecreatefromgif($path),
            default => false,
        };
    }

    /** @return array{0: int, 1: int} */
    protected function fitWithin(int $width, int $height, int $maxEdge): array
    {
        $longest = max($width, $height);
        if ($longest <= $maxEdge) {
            return [$width, $height];
        }

        $scale = $maxEdge / $longest;

        return [
            max(1, (int) round($width * $scale)),
            max(1, (int) round($height * $scale)),
        ];
    }
}
