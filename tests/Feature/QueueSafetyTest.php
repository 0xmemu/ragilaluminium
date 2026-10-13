<?php

namespace Tests\Feature;

use App\Jobs\ProcessCatalogImport;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Tests\TestCase;

class QueueSafetyTest extends TestCase
{
    public function test_import_visibility_and_uniqueness_exceed_job_timeout(): void
    {
        $job = new ProcessCatalogImport(123, 'catalog/test.xlsx');

        $this->assertInstanceOf(ShouldBeUnique::class, $job);
        $this->assertGreaterThan($job->timeout, $job->uniqueFor);
        $this->assertGreaterThan($job->timeout, config('queue.connections.database.retry_after'));
        $this->assertGreaterThan($job->timeout, config('queue.connections.redis.retry_after'));
        $this->assertSame('catalog:123', $job->uniqueId());
    }

    public function test_import_job_has_application_overlap_lock(): void
    {
        $job = new ProcessCatalogImport(456, 'catalog/test.xlsx', 'media');
        $middleware = $job->middleware();

        $this->assertCount(1, $middleware);
        $this->assertInstanceOf(WithoutOverlapping::class, $middleware[0]);
        $this->assertSame('media:456', $job->uniqueId());
    }
}
