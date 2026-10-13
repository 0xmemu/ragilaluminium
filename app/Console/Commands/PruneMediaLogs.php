<?php

namespace App\Console\Commands;

use App\Models\MediaProcessingLog;
use Illuminate\Console\Command;

class PruneMediaLogs extends Command
{
    protected $signature = 'media:prune-logs {--days=30 : Hapus log lebih tua dari N hari} {--dry-run : Tampilkan jumlah tanpa menghapus}';

    protected $description = 'Pangkas log riwayat pemrosesan media yang lebih tua dari N hari agar tabel tidak membengkak.';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = now()->subDays($days);

        $count = MediaProcessingLog::where('created_at', '<', $cutoff)->count();

        if ($dryRun) {
            $this->info("DRY-RUN: {$count} log lebih tua dari {$days} hari (cutoff {$cutoff->toDateTimeString()}).");

            return self::SUCCESS;
        }

        $deleted = MediaProcessingLog::where('created_at', '<', $cutoff)->delete();
        $this->info("Dihapus {$deleted} log riwayat media lebih tua dari {$days} hari.");

        return self::SUCCESS;
    }
}
