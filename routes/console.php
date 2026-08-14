<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

if ((bool) config('operations.queue_monitor.enabled', true)) {
    $connection = (string) config('operations.queue_monitor.connection', 'database');
    $targets = array_map(
        fn (string $queue): string => $connection.':'.$queue,
        config('operations.queue_monitor.queues', ['default', 'imports', 'media']),
    );

    if ($targets !== []) {
        Schedule::command('queue:monitor', [
            implode(',', $targets),
            '--max' => (int) config('operations.queue_monitor.max_jobs', 100),
        ])->everyMinute()->withoutOverlapping();
    }
}

Schedule::command('queue:prune-failed', [
    '--hours' => (int) config('operations.failed_job_retention_hours', 168),
])->dailyAt('02:15')->withoutOverlapping();

// Bersihkan upload presigned yang tidak pernah difinalisasi (pending/ > 24 jam)
// lalu kirim notifikasi admin dengan rincian pembersihan.
Schedule::command('media:prune-pending', [
    '--hours' => (int) config('media.pending_prune_hours', 24),
])->dailyAt('03:00')->withoutOverlapping();

// Pangkas log riwayat pemrosesan media yang lebih tua dari masa retensi.
Schedule::command('media:prune-logs', [
    '--days' => (int) config('media.log_retention_days', 30),
])->dailyAt('03:30')->withoutOverlapping();
