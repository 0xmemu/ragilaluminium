<?php

namespace App\Http\Middleware;

use App\Support\OperationalTelemetry;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class RequestContext
{
    public const HEADER = 'X-Request-ID';

    private const ID_PATTERN = '/\A[A-Za-z0-9][A-Za-z0-9._-]{7,127}\z/D';

    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = hrtime(true);
        $upstreamId = trim((string) $request->headers->get(self::HEADER, ''));
        $requestId = preg_match(self::ID_PATTERN, $upstreamId) === 1
            ? $upstreamId
            : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);

        Context::add([
            'request_id' => $requestId,
            'request_method' => $request->method(),
            'request_path' => '/'.$request->path(),
        ]);

        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            OperationalTelemetry::requestCompleted(
                method: $request->method(),
                route: $this->routeName($request),
                status: $this->exceptionStatus($exception),
                durationMs: $this->durationMs($startedAt),
                exceptionClass: $exception::class,
            );

            throw $exception;
        }

        $response->headers->set(self::HEADER, $requestId);

        OperationalTelemetry::requestCompleted(
            method: $request->method(),
            route: $this->routeName($request),
            status: $response->getStatusCode(),
            durationMs: $this->durationMs($startedAt),
        );

        return $response;
    }

    private function routeName(Request $request): string
    {
        $name = $request->route()?->getName();

        return is_string($name) && $name !== '' ? $name : 'unmatched';
    }

    private function durationMs(int $startedAt): float
    {
        return (hrtime(true) - $startedAt) / 1_000_000;
    }

    private function exceptionStatus(Throwable $exception): int
    {
        if ($exception instanceof HttpExceptionInterface) {
            return $exception->getStatusCode();
        }

        if ($exception instanceof ValidationException) {
            return 422;
        }

        if ($exception instanceof AuthorizationException) {
            return 403;
        }

        if ($exception instanceof ModelNotFoundException) {
            return 404;
        }

        return 500;
    }
}
