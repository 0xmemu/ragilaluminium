<?php

namespace App\Providers;

use App\Services\CartService;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CartService::class, function ($app) {
            return new CartService($app->make('session.store'));
        });
    }

    public function boot(): void
    {
        // Keep asset/Ziggy URLs on the *current* request host.
        // Forcing APP_URL (ra.natauma.me) breaks http://VPS_IP:8200 — Vite JS is
        // cross-origin, CORS-blocked, React never mounts, homepage cards look empty.
        if (! $this->app->runningInConsole()) {
            $request = request();
            $forwarded = strtolower((string) $request->headers->get('X-Forwarded-Proto', ''));
            if ($request->secure() || $forwarded === 'https') {
                URL::forceScheme('https');
            }
        }

        View::composer(
            ['layouts.public', 'layouts.admin', 'components.public.*', 'components.admin.*', 'public.*', 'admin.*', 'auth.*'],
            function ($view) {
                $view->with('sitemap', config('sitemap'));
                $view->with('adminSitemap', config('admin-sitemap'));
                $view->with('siteBrand', config('sitemap.brand'));
                $view->with('adminBrand', config('admin-sitemap.brand'));
            }
        );

        View::composer('components.public.desktop-header', function ($view) {
            $view->with('megaMenuNav', \App\Support\CatalogTaxonomy::megaMenuNav());
        });
    }
}
