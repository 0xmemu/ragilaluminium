<?php

namespace App\Console\Commands;

use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Hapus JPG/PNG original yang sudah punya WebP thumb/card/pdp (hemat R2/local disk).
 */
class PruneMediaOriginals extends Command
{
    protected $signature = 'media:prune-originals
                            {--chunk=100 : Rows per chunk}
                            {--dry-run : Hanya hitung, tidak hapus file}
                            {--disk : Juga hapus JPG/PNG orphan di disk bila sibling *-pdp.webp ada}';

    protected $description = 'Delete heavy originals when WebP derivatives exist (MEDIA_KEEP_ORIGINAL=false)';

    public function handle(MediaDerivativeService $derivatives): int
    {
        if ($derivatives->keepOriginal()) {
            $this->warn('MEDIA_KEEP_ORIGINAL=true — prune dibatalkan. Set false untuk menghapus original.');

            return self::SUCCESS;
        }

        $chunk = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $ok = 0;
        $skip = 0;
        $fail = 0;
        $bytesFreed = 0;

        ProductMedia::query()
            ->where('status', 'downloaded')
            ->whereNotNull('stored_path')
            ->whereNotNull('derivatives')
            ->orderBy('id')
            ->chunkById($chunk, function ($rows) use ($derivatives, $dryRun, &$ok, &$skip, &$fail, &$bytesFreed) {
                foreach ($rows as $media) {
                    $path = (string) $media->stored_path;
                    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                    if (in_array($ext, ['webp'], true)) {
                        $skip++;

                        continue;
                    }

                    $built = is_array($media->derivatives) ? $media->derivatives : [];
                    if ($built === []) {
                        $skip++;

                        continue;
                    }

                    try {
                        if ($dryRun) {
                            $ok++;

                            continue;
                        }

                        $before = $media->size_bytes ?? 0;
                        $promoted = $derivatives->promoteMasterAndDiscardOriginal($path, $built);
                        if ($promoted === null) {
                            $skip++;

                            continue;
                        }

                        $media->update(array_merge(['derivatives' => $built], $promoted));
                        $bytesFreed += max(0, (int) $before - (int) ($promoted['size_bytes'] ?? 0));
                        $ok++;
                    } catch (\Throwable $e) {
                        $this->error("Media {$media->id}: {$e->getMessage()}");
                        $fail++;
                    }
                }
            });

        $freedMb = round($bytesFreed / 1048576, 1);
        $this->info($dryRun
            ? "Dry-run DB: {$ok} originals would be pruned (skip={$skip})."
            : "Pruned DB {$ok} originals (~{$freedMb} MB claimed from size_bytes). skip={$skip} fail={$fail}");

        if ($this->option('disk')) {
            [$diskOk, $diskBytes, $diskFail] = $this->pruneDiskOrphans($dryRun);
            $diskMb = round($diskBytes / 1048576, 1);
            $this->info($dryRun
                ? "Dry-run disk: {$diskOk} orphan originals (~{$diskMb} MB)."
                : "Pruned disk {$diskOk} orphan originals (~{$diskMb} MB). fail={$diskFail}");
            $fail += $diskFail;
        }

        return $fail > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return array{0: int, 1: int, 2: int} [ok, bytes, fail]
     */
    protected function pruneDiskOrphans(bool $dryRun): array
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $ok = 0;
        $fail = 0;
        $bytes = 0;

        foreach ($disk->allFiles('products') as $path) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (! in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
                continue;
            }

            $dir = trim(str_replace('\\', '/', dirname($path)), '.');
            $base = pathinfo($path, PATHINFO_FILENAME);
            $pdp = ($dir === '' ? '' : $dir.'/').$base.'-pdp.webp';
            if (! $disk->exists($pdp)) {
                continue;
            }

            try {
                $size = $disk->exists($path) ? (int) $disk->size($path) : 0;
                if (! $dryRun) {
                    $disk->delete($path);
                }
                $bytes += $size;
                $ok++;
            } catch (\Throwable $e) {
                $this->error("Disk {$path}: {$e->getMessage()}");
                $fail++;
            }
        }

        return [$ok, $bytes, $fail];
    }
}
