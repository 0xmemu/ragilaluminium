<?php

namespace App\Http\Middleware;

use App\Services\StorePerformanceService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrackStorefrontPageView
{
    public function __construct(protected StorePerformanceService $performance)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethod('GET')) {
            return $response;
        }

        if ($request->is('admin*', 'login', 'logout', 'webhook*', 'api*', 'up', 'build*', 'images*', 'storage*')) {
            return $response;
        }

        if ($request->header('X-Inertia') || $request->ajax()) {
            // Still count full document navigations; Inertia partials are GET with X-Inertia.
            // Count Inertia visits too — they are real page views.
        }

        try {
            $this->performance->trackPageView((string) $request->session()->getId());
        } catch (\Throwable) {
            // Never break storefront if metrics write fails.
        }

        return $response;
    }
}
