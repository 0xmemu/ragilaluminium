<?php

namespace App\Support;

use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;

final class OperationalTelemetry
{
    public static function requestCompleted(
        string $method,
        string $route,
        int $status,
        float $durationMs,
        ?string $exceptionClass = null,
    ): void {
        $context = [
            'schema_version' => 1,
            'request_id' => self::requestId(),
            'method' => $method,
            'route' => $route,
            'status' => $status,
            'duration_ms' => round($durationMs, 2),
        ];

        if ($exceptionClass !== null) {
            $context['exception_class'] = $exceptionClass;
        }

        Log::log(
            $status >= 500 ? 'error' : ($status >= 400 ? 'warning' : 'info'),
            'http_request_completed',
            $context,
        );
    }

    public static function checkoutOutcome(
        string $outcome,
        ?string $paymentMethod,
        bool $idempotencyReplay = false,
    ): void {
        Log::info('checkout_outcome', [
            'schema_version' => 1,
            'request_id' => self::requestId(),
            'outcome' => $outcome,
            'payment_method' => $paymentMethod,
            'idempotency_replay' => $idempotencyReplay,
        ]);
    }

    private static function requestId(): ?string
    {
        $requestId = Context::get('request_id');

        return is_string($requestId) && $requestId !== '' ? $requestId : null;
    }
}
