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
