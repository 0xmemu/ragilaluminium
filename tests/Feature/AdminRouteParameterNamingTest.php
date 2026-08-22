<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Kontrak penamaan route admin: parameter route WAJIB cocok dengan variabel
 * method controller (implicit model binding).
 *
 * Latar: Route::resource('kelola/produk', ...) men-generate parameter {produk}
 * dari segmen URI "produk", sementara seluruh kode memakai $product
 * (edit(Product $product), route('admin.products.update', $product)) ->
 * UrlGenerationException/TypeError 500 di semua halaman edit produk.
 * Fix: ->parameters(['produk' => 'product']). Test ini mencegah regresi
 * dengan memeriksa binding tiap route admin berparameter.
 */
class AdminRouteParameterNamingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_route_params_match_controller_method_variables(): void
    {
        $routes = Route::getRoutes();
        $violations = [];
        $checked = 0;

        foreach ($routes as $route) {
            $uri = $route->uri();
            if (! str_starts_with($uri, 'admin/')) {
                continue;
            }

            $params = array_values(array_filter(
                $route->parameterNames(),
                fn (string $p): bool => $p !== 'any',
            ));
            if ($params === []) {
                continue;
            }

            $action = $route->getActionName();
            if (! str_contains($action, '@')) {
                continue; // closure / invokable
            }
            [$class, $method] = explode('@', $action);
            if (! class_exists($class) || ! method_exists($class, $method)) {
                $violations[] = "{$uri} -> {$action} class/method tidak ditemukan";

                continue;
            }

            $checked++;

            $boundParams = [];
            foreach ((new ReflectionMethod($class, $method))->getParameters() as $p) {
                $type = $p->getType();
                if ($type && ! $type->isBuiltin()) {
                    $boundParams[$p->getName()] = $type->getName();
                }
            }

            foreach ($params as $rp) {
                $snake = str_replace('-', '_', $rp);
                $matched = collect($boundParams)->keys()->contains(
                    fn (string $var): bool => strtolower($var) === strtolower($snake),
                );
                if (! $matched) {
                    $violations[] = "{$uri} ({$route->getName()}) -> parameter {{$rp}} tidak cocok dengan method vars ["
                        .implode(', ', array_keys($boundParams)).'] di '.$action;
                }
            }
        }

        $this->assertNotEmpty($checked, 'Tidak ada route admin berparameter yang dicek');
        $this->assertSame([], $violations, implode("\n", $violations));
    }

    public function test_every_admin_route_with_parameters_generates_url_with_its_own_param_names(): void
    {
        $routes = Route::getRoutes();
        $failures = [];

        foreach ($routes as $route) {
            $uri = $route->uri();
            if (! str_starts_with($uri, 'admin/')) {
                continue;
            }
            $name = $route->getName();
            if (! $name) {
                continue;
            }
            $params = array_values(array_filter(
                $route->parameterNames(),
                fn (string $p): bool => $p !== 'any',
            ));
            if ($params === []) {
                continue;
            }

            try {
                route($name, array_fill_keys($params, 1));
            } catch (\Throwable $e) {
                $failures[] = "{$uri} ({$name}): ".$e->getMessage();
            }
        }

        $this->assertSame([], $failures, implode("\n", $failures));
    }
}
