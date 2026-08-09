<?php

namespace App\Providers;

use App\Services\CampaignService;
use App\Services\CartService;
use App\Support\CatalogTaxonomy;
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

        $this->app->singleton(CampaignService::class);
    }

    public function boot(): void
    {
        if ($this->app->environment('production')
            && config('jnt.enabled')
            && blank(config('jnt.webhook.private_key'))) {
            throw new \RuntimeException(
                'JNT_WEBHOOK_PRIVATE_KEY (atau JNT_PRIVATE_KEY fallback) wajib saat J&T aktif di production.'
            );
        }
        if ($this->app->environment('production')) {
            if (config('services.whatsapp.allow_unsigned_webhooks')) {
                throw new \RuntimeException(
                    'WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS wajib false di production.'
                );
            }

            $providers = array_filter([
                (string) config('services.whatsapp.default_provider'),
                (string) config('services.whatsapp.compare_provider'),
            ]);

            if (in_array('meta', $providers, true)
                && (filled(config('services.whatsapp.meta.token')) || filled(config('services.whatsapp.meta.number_id')))
                && blank(config('services.whatsapp.app_secret'))) {
                throw new \RuntimeException(
                    'WHATSAPP_APP_SECRET wajib saat provider Meta aktif di production.'
                );
            }

            if (in_array('baileys', $providers, true)
                && filled(config('services.whatsapp.baileys.base_url'))
                && blank(config('services.whatsapp.baileys.webhook_secret'))) {
                throw new \RuntimeException(
                    'WHATSAPP_BAILEYS_WEBHOOK_SECRET wajib saat provider BAILEYS aktif di production.'
                );
            }
            if (config('app.debug')) {
                throw new \RuntimeException('APP_DEBUG wajib false di production.');
            }

            if (parse_url((string) config('app.url'), PHP_URL_SCHEME) !== 'https') {
                throw new \RuntimeException('APP_URL wajib memakai HTTPS di production.');
            }

            if (! config('security.force_https')) {
                throw new \RuntimeException('FORCE_HTTPS wajib true di production.');
            }

            if (config('session.secure') !== true) {
                throw new \RuntimeException('SESSION_SECURE_COOKIE wajib true di production.');
            }

            if (config('session.http_only') !== true) {
                throw new \RuntimeException('SESSION_HTTP_ONLY wajib true di production.');
            }

            $trustedProxies = config('security.trusted_proxies', []);
            if (! is_array($trustedProxies)
                || $trustedProxies === []
                || array_intersect($trustedProxies, ['*', '**']) !== []) {
                throw new \RuntimeException(
                    'TRUSTED_PROXIES wajib berisi allowlist IP/CIDR tanpa wildcard di production.'
                );
            }
        }

        if (config('security.force_https')) {
            URL::forceScheme('https');
        } elseif (! $this->app->runningInConsole() && request()->secure()) {
            URL::forceScheme('https');
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
            $view->with('megaMenuNav', CatalogTaxonomy::megaMenuNav());
        });
    }
}
