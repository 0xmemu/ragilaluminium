<?php

namespace App\Support;

use App\Models\MediaAsset;
use Illuminate\Support\Facades\Storage;

/**
 * Penamaan otomatis file media dengan pola {context}_{nomor}_{tanggal}.{ext}.
 * Contoh: banner_1_20260814.png, logo_3_20260814.png, testimonial_2_20260814.jpg.
 *
 * - asset(): untuk alur presigned (MediaAsset) — nomor dihitung dari label
 *   asset sejenis di DB sehingga monotonik dan tidak reset saat pending dibersihkan.
 * - onDisk(): untuk penyimpanan file langsung di disk (R2/local) — nomor dari
 *   file sejenis di folder tujuan.
 * - local(): untuk direktori lokal (mis. public/images) lewat glob().
 */
final class MediaNamer
{
    /** Nama lengkap untuk alur MediaAsset (nomor dari label DB). */
    public static function asset(string $context, string $extension): string
    {
        $context = self::slug($context);
        $extension = self::extension($extension);

        $labels = MediaAsset::where('label', 'like', $context.'\_%')->pluck('label');
        $max = 0;
        foreach ($labels as $label) {
            if (preg_match('/^'.preg_quote($context, '/').'_(\d+)_\d{8}$/', (string) $label, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return self::build($context, $max + 1, $extension);
    }

    /** Nama file di disk Laravel (R2/local) — nomor dari file sejenis di folder. */
    public static function onDisk(string $context, string $extension, string $diskName, string $directory): string
    {
        $context = self::slug($context);
        $extension = self::extension($extension);
        $disk = Storage::disk($diskName);

        $max = self::maxNumber(
            array_map('basename', $disk->files($directory)),
            $context,
        );
        $name = self::build($context, $max + 1, $extension);
        while ($disk->exists($directory.'/'.$name)) {
            $name = self::build($context, $max + 2, $extension);
            $max++;
        }

        return $name;
    }

    /** Nama file di direktori lokal (mis. public_path('images')) via glob. */
    public static function local(string $context, string $extension, string $directoryPath): string
    {
        $context = self::slug($context);
        $extension = self::extension($extension);

        $existing = is_dir($directoryPath)
            ? (glob($directoryPath.'/'.$context.'_*') ?: [])
            : [];
        $max = self::maxNumber(array_map('basename', $existing), $context);
        $name = self::build($context, $max + 1, $extension);
        while (file_exists($directoryPath.'/'.$name)) {
            $name = self::build($context, $max + 2, $extension);
            $max++;
        }

        return $name;
    }

    /** @param list<string> $bases */
    private static function maxNumber(array $bases, string $context): int
    {
        $pattern = '/^'.preg_quote($context, '/').'_(\d+)_\d{8}\./';
        $max = 0;
        foreach ($bases as $base) {
            if (preg_match($pattern, (string) $base, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return $max;
    }

    private static function build(string $context, int $number, string $extension): string
    {
        return sprintf('%s_%d_%s.%s', $context, $number, now()->format('Ymd'), $extension);
    }

    private static function extension(string $extension): string
    {
        return strtolower(ltrim($extension, '.'));
    }

    private static function slug(string $value): string
    {
        $value = strtolower(trim($value));
        $value = preg_replace('/[^a-z0-9]+/', '-', $value);

        return trim((string) $value, '-') ?: 'media';
    }
}
