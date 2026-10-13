<?php

namespace App\Listeners;

use App\Support\OperationalAlert;
use Illuminate\Queue\Events\JobFailed;
use Throwable;

class ReportQueueJobFailure
{
    public function __construct(private readonly OperationalAlert $alerts) {}

    public function handle(JobFailed $event): void
    {
        $this->alerts->critical('queue_job_failed', [
            'connection' => $event->connectionName,
            'queue' => $this->readJobMetadata(fn () => $event->job->getQueue()),
            'job_id' => $this->readJobMetadata(fn () => $event->job->getJobId()),
            'job_name' => $this->readJobMetadata(fn () => $event->job->resolveName(), $event->job::class),
            'attempts' => $this->readJobMetadata(fn () => $event->job->attempts()),
            'exception_class' => $event->exception::class,
        ]);
    }

    private function readJobMetadata(callable $reader, bool|float|int|string|null $fallback = null): bool|float|int|string|null
    {
        try {
            $value = $reader();

            return is_bool($value) || is_float($value) || is_int($value) || is_string($value) || $value === null
                ? $value
                : $fallback;
        } catch (Throwable) {
            return $fallback;
        }
    }
}
