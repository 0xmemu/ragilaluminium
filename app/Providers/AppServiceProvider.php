<?php

namespace App\Providers;

use App\Services\CartService;
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
