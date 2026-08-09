<?php

namespace Tests\Feature;

use App\Listeners\ReportQueueBusy;
use App\Listeners\ReportQueueJobFailure;
use App\Support\OperationalAlert;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class OperationalReliabilityTest extends TestCase
{
    public function test_queue_failure_alert_contains_safe_metadata_without_exception_message_or_payload(): void
    {
        $job = Mockery::mock(Job::class);
        $job->shouldReceive('getQueue')->once()->andReturn('imports');
        $job->shouldReceive('getJobId')->once()->andReturn('job-123');
        $job->shouldReceive('resolveName')->once()->andReturn('App\\Jobs\\ProcessCatalogImport');
        $job->shouldReceive('attempts')->once()->andReturn(3);

        $alerts = Mockery::mock(OperationalAlert::class);
        $alerts->shouldReceive('critical')
            ->once()
            ->with('queue_job_failed', Mockery::on(function (array $context): bool {
                $encoded = json_encode($context);

                return $context === [
                    'connection' => 'redis',
                    'queue' => 'imports',
                    'job_id' => 'job-123',
                    'job_name' => 'App\\Jobs\\ProcessCatalogImport',
                    'attempts' => 3,
                    'exception_class' => RuntimeException::class,
                ] && is_string($encoded) && ! str_contains($encoded, 'credential-in-exception');
            }));

        (new ReportQueueJobFailure($alerts))->handle(new JobFailed(
            'redis',
            $job,
            new RuntimeException('credential-in-exception'),
        ));
    }

    public function test_queue_busy_alert_contains_threshold_and_queue_size(): void
    {
        config(['operations.queue_monitor.max_jobs' => 75]);
        $alerts = Mockery::mock(OperationalAlert::class);
        $alerts->shouldReceive('warning')->once()->with('queue_busy', [
            'connection' => 'redis',
            'queue' => 'media',
            'size' => 81,
            'max_jobs' => 75,
        ]);

        (new ReportQueueBusy($alerts))->handle(new QueueBusy('redis', 'media', 81));
    }

    public function test_operational_alert_uses_dedicated_log_channel(): void
    {
        config(['operations.alert_log_channel' => 'stack']);
        Log::shouldReceive('channel')->once()->with('stack')->andReturnSelf();
        Log::shouldReceive('log')->once()->with('critical', 'test_event', ['safe' => 'value']);

        (new OperationalAlert)->critical('test_event', ['safe' => 'value']);
    }

    public function test_queue_events_are_registered_and_scheduler_monitors_and_prunes(): void
    {
        $this->assertTrue(app('events')->hasListeners(JobFailed::class));
        $this->assertTrue(app('events')->hasListeners(QueueBusy::class));

        Artisan::call('schedule:list');
        $output = Artisan::output();

        $this->assertStringContainsString('queue:monitor', $output);
        $this->assertStringContainsString('queue:prune-failed', $output);
    }
}
