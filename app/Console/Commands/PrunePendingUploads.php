<?php

namespace App\Console\Commands;

use App\Models\AdminNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Bersihkan objek upload pending/ di disk media (R2/local) yang tidak pernah
 * difinalisasi dalam N jam (upload presigned yang dibatalkan/gagal submit).
 * Membuat notifikasi admin dengan rincian hasil pembersihan.
 */
class PrunePendingUploads extends Command
{
    protected $signature = 'media:prune-pending
                            {--hours=24 : Umur minimal (jam) objek pending untuk dihapus}
                            {--dry-run : Hanya laporan, tanpa menghapus file}';

    protected $description = 'Hapus objek pending/ yang tidak difinalisasi + notifikasi admin';

    public function handle(): int
    {
        $hours = max(1, (int) $this->option('hours'));
        $dryRun = (bool) $this->option('dry-run');
        $disk = Storage::disk(config('media.disk', 'media'));
        $cutoff = now()->subHours($hours);

        $files = $disk->allFiles('pending');
        $candidates = [];
        foreach ($files as $path) {
            try {
                $modified = $disk->lastModified($path);
                if ($modified !== false && $modified < $cutoff->getTimestamp()) {
                    $size = (int) ($disk->size($path) ?: 0);
                    $candidates[] = ['path' => $path, 'size' => $size];
                }
            } catch (\Throwable $e) {
                $this->warn("Skip {$path}: {$e->getMessage()}");
            }
        }

        $count = count($candidates);
        $bytes = array_sum(array_column($candidates, 'size'));
        $freedMb = round($bytes / 1048576, 2);

        if ($count === 0) {
            $this->info("media:prune-pending — tidak ada objek pending/ lebih tua dari {$hours} jam.");

            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->info("Dry-run: {$count} objek pending/ (~{$freedMb} MB) akan dihapus (cutoff {$hours} jam).");

            return self::SUCCESS;
        }

        $deleted = 0;
        foreach ($candidates as $candidate) {
            try {
                $disk->delete($candidate['path']);
                $deleted++;
            } catch (\Throwable $e) {
                $this->error("Gagal hapus {$candidate['path']}: {$e->getMessage()}");
            }
        }

        $samples = array_slice(array_column($candidates, 'path'), 0, 5);
        $body = "{$deleted} file upload pending/ dihapus (~{$freedMb} MB)."
            ." Cutoff: {$hours} jam."
            .($samples !== [] ? ' Contoh: '.implode(', ', $samples).($count > 5 ? ' …' : '').'.' : '');

        AdminNotification::create([
            'type' => 'media_cleanup',
            'title' => 'Pembersihan upload pending selesai',
            'body' => $body,
            'href' => route('admin.media.library'),
        ]);

        $this->info("Dihapus {$deleted}/{$count} objek pending/ (~{$freedMb} MB); notifikasi admin dibuat.");

        return $deleted === $count ? self::SUCCESS : self::FAILURE;
    }
}
