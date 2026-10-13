<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RequestContext;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\TrackStorefrontPageView;
use App\Http\Middleware\VerifyBaileysKey;
use App\Http\Middleware\VerifyJntSignature;
use App\Providers\EventServiceProvider;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([
        EventServiceProvider::class,
    ])
    // Matikan auto-discovery listener framework (base EventServiceProvider akan
    // men-scan app/Listeners dan mendaftarkan setiap listener DUA KALI:
    // satu dari $listen provider ini, satu lagi sebagai Class@handle discovery -
    // berakibat event di-proses 2x (double WhatsApp/engagement). Semua listener
    // domain sudah didaftarkan eksplisit di EventServiceProvider::$listen.
    ->withEvents(
        discover: false,
    )
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Trust only the reverse proxies explicitly provisioned for this environment.
        // NOTE: config() is unavailable here (container alias not registered during bootstrap),
        // so mirror config/security.php's env parsing instead.
        $trustedProxies = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('TRUSTED_PROXIES', '127.0.0.1,::1')),
        )));
        $middleware->trustProxies(
            at: $trustedProxies,
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO
                | Request::HEADER_X_FORWARDED_PREFIX,
        );

        // Correlate every request, log entry, and dispatched queue job without exposing request data.
        $middleware->append(RequestContext::class);

        // Audit fix: baseline security headers on every response (X-Frame-Options, HSTS, etc.).
        $middleware->append(SecurityHeaders::class);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            TrackStorefrontPageView::class,
        ]);

        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'verify.jnt.signature' => VerifyJntSignature::class,
            'verify.baileys.key' => VerifyBaileysKey::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'webhook/*',
            'api/jnt',
            // Admin WhatsApp pairing endpoints (auth+admin protected; proxied to bot with API key).
            'admin/whatsapp/pairing/*',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            $status = $response->getStatusCode();

            if (! in_array($status, [403, 404, 500, 503], true)) {
                return $response;
            }

            // Keep JSON/API error payloads; brand HTML + Inertia responses.
            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return $response;
            }

            // HandleInertiaRequests (grup web) TIDAK berjalan untuk URL yang tidak
            // cocok route mana pun -> shared props (auth/nav/ziggy/flash) hilang dari
            // payload sehingga halaman error React crash/blank. Register ulang manual.
            if (! Inertia::getShared('auth')) {
                $inertiaMiddleware = app(HandleInertiaRequests::class);
                Inertia::version($inertiaMiddleware->version($request));
                Inertia::share($inertiaMiddleware->share($request));
            }

            $page = $request->is('admin', 'admin/*')
                ? 'Admin/Error'
                : 'Public/Error';

            return Inertia::render($page, [
                'status' => $status,
            ])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
