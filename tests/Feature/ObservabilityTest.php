<?php

namespace Tests\Feature;

use App\Http\Middleware\RequestContext;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class ObservabilityTest extends TestCase
{
    public function test_readiness_endpoint_reports_dependency_status_without_cacheing(): void
    {
        $response = $this->getJson('/api/health/ready');

        $response
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'checks' => [
                    'database' => 'pass',
                    'cache' => 'pass',
                    'storage' => 'pass',
                ],
            ]);

        $this->assertStringContainsString(
            'no-store',
            (string) $response->headers->get('Cache-Control'),
        );
        $this->assertTrue(Str::isUuid((string) $response->headers->get(RequestContext::HEADER)));
    }

    public function test_valid_upstream_request_id_is_preserved_in_context_and_response(): void
    {
        Route::get('/_test/request-context', fn () => response()->json([
            'request_id' => Context::get('request_id'),
        ]));

        $requestId = 'edge-12345678';

        $this->withHeader(RequestContext::HEADER, $requestId)
            ->getJson('/_test/request-context')
            ->assertOk()
            ->assertHeader(RequestContext::HEADER, $requestId)
            ->assertJsonPath('request_id', $requestId);
    }

    public function test_invalid_upstream_request_id_is_replaced(): void
    {
        Route::get('/_test/request-context-invalid', fn () => response()->json([
            'request_id' => Context::get('request_id'),
        ]));

        $response = $this->withHeader(RequestContext::HEADER, 'bad id')
            ->getJson('/_test/request-context-invalid')
            ->assertOk();

        $generated = (string) $response->headers->get(RequestContext::HEADER);

        $this->assertTrue(Str::isUuid($generated));
        $response->assertJsonPath('request_id', $generated);
    }

    public function test_completed_request_log_is_structured_and_excludes_query_data(): void
    {
        Log::spy();

        Route::get('/_test/request-telemetry', fn () => response()->json(['ok' => true]))
            ->name('test.request-telemetry');

        $response = $this->getJson('/_test/request-telemetry?email=private@example.com');
        $requestId = (string) $response->headers->get(RequestContext::HEADER);

        $response->assertOk();
        Log::shouldHaveReceived('log')
            ->withArgs(function ($level, $message, $context) use ($requestId): bool {
                return $level === 'info'
                    && $message === 'http_request_completed'
                    && $context['schema_version'] === 1
                    && $context['request_id'] === $requestId
                    && $context['method'] === 'GET'
                    && $context['route'] === 'test.request-telemetry'
                    && $context['status'] === 200
                    && is_numeric($context['duration_ms'])
                    && ! array_key_exists('query', $context)
                    && ! array_key_exists('email', $context);
            })
            ->once();
    }
}
