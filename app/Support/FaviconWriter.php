<?php

namespace App\Support;

/**
 * Menurunkan seluruh berkas favicon dari satu gambar sumber.
 *
 * Satu sumber kebenaran (favicon yang diunggah admin) harus menghasilkan semua
 * turunan yang dipakai <head>, supaya tidak ada berkas basi: browser modern
 * memilih PNG lebih dulu, jadi PNG yang tidak ikut diperbarui akan membuat
 * favicon lama terus tampil walau admin sudah menggantinya.
 *
 * Bila sumber tidak dapat dibaca GD (mis. format ICO asli yang tidak dikenali),
 * turunan PNG dihapus agar berkas ICO yang baru dipakai, bukan PNG lama.
 */
class FaviconWriter
{
    /** Nama berkas turunan relatif terhadap $basePath. */
    public const PNG_32 = 'images/favicon-32.png';

    public const PNG_16 = 'images/favicon-16.png';

    public const APPLE_TOUCH = 'apple-touch-icon.png';

    /**
     * Selaraskan turunan favicon dengan gambar sumber.
     *
     * @return bool true bila turunan PNG berhasil dibuat dari sumber.
     */
    public function sync(string $sourcePath, ?string $basePath = null): bool
    {
        $basePath = rtrim($basePath ?? public_path(), '/\\');

        $image = $this->readImage($sourcePath);
        if ($image === null) {
            $this->removeDerivatives($basePath);

            return false;
        }

        try {
            $this->write($image, 32, 32, $basePath.'/'.self::PNG_32);
            $this->write($image, 16, 16, $basePath.'/'.self::PNG_16);
            // iOS mengabaikan transparansi dan dapat memberi latar hitam, jadi
            // apple-touch-icon ditempel di atas latar putih lebih dulu.
            $apple = $this->onWhite($image);
            try {
                $this->write($apple, 180, 180, $basePath.'/'.self::APPLE_TOUCH);
            } finally {
                imagedestroy($apple);
            }
        } finally {
            imagedestroy($image);
        }

        return true;
    }

    /** Hapus turunan PNG supaya berkas ICO yang dipakai. */
    public function removeDerivatives(string $basePath): void
    {
        foreach ([self::PNG_32, self::PNG_16, self::APPLE_TOUCH] as $relative) {
            $path = rtrim($basePath, '/\\').'/'.$relative;
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    private function readImage(string $path): ?\GdImage
    {
        if (! is_file($path) || filesize($path) === 0) {
            return null;
        }

        $contents = @file_get_contents($path);
        if ($contents === false || $contents === '') {
            return null;
        }

        $image = @imagecreatefromstring($contents);

        return $image === false ? null : $image;
    }

    /** Latar putih penuh, gambar ditempelkan di atasnya. */
    private function onWhite(\GdImage $image): \GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);

        $canvas = imagecreatetruecolor($width, $height);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, false);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagealphablending($canvas, true);
        imagecopy($canvas, $image, 0, 0, 0, 0, $width, $height);

        return $canvas;
    }

    private function write(\GdImage $image, int $width, int $height, string $target): void
    {
        $canvas = imagecreatetruecolor($width, $height);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        imagefill($canvas, 0, 0, imagecolorallocatealpha($canvas, 0, 0, 0, 127));

        imagecopyresampled(
            $canvas,
            $image,
            0,
            0,
            0,
            0,
            $width,
            $height,
            imagesx($image),
            imagesy($image),
        );

        $directory = dirname($target);
        if (! is_dir($directory)) {
            @mkdir($directory, 0775, true);
        }

        imagepng($canvas, $target);
        imagedestroy($canvas);
    }
}
