<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

final class ReadinessController
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->passes('database', fn () => DB::connection()->select('SELECT 1')),
            'cache' => $this->passes('cache', fn () => Cache::store()->get('__readiness_probe__')),
            'storage' => $this->passes('storage', function (): void {
                if (! is_readable(storage_path()) || ! is_writable(storage_path())) {
                    throw new RuntimeException('Storage path is unavailable.');
                }
            }),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()
            ->json([
                'status' => $healthy ? 'ok' : 'degraded',
                'checks' => array_map(
                    static fn (bool $passed): string => $passed ? 'pass' : 'fail',
                    $checks,
                ),
            ], $healthy ? 200 : 503)
            ->header('Cache-Control', 'no-store');
    }

    private function passes(string $dependency, Closure $check): bool
    {
        try {
            $check();

            return true;
        } catch (Throwable $exception) {
            Log::warning('readiness_dependency_failed', [
                'dependency' => $dependency,
                'exception_class' => $exception::class,
            ]);

            return false;
        }
    }
}
