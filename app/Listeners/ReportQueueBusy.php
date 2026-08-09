<?php

namespace App\Listeners;

use App\Support\OperationalAlert;
use Illuminate\Queue\Events\QueueBusy;

class ReportQueueBusy
{
    public function __construct(private readonly OperationalAlert $alerts) {}

    public function handle(QueueBusy $event): void
    {
        $this->alerts->warning('queue_busy', [
            'connection' => $event->connection,
            'queue' => $event->queue,
            'size' => $event->size,
            'max_jobs' => (int) config('operations.queue_monitor.max_jobs', 100),
        ]);
    }
}
