<?php

namespace App\Support;

class PublicNavigation
{
    /**
     * @param  array<int, string>|string  $patterns  Route name patterns for request()->routeIs()
     */
    public static function isActive(array|string $patterns): bool
    {
        foreach ((array) $patterns as $pattern) {
            if (request()->routeIs($pattern)) {
                return true;
            }

            [$canonical, $params] = self::canonicalRoute($pattern);
            if (
                $canonical === 'catalog.category'
                && request()->routeIs('catalog.category', 'catalog.model', 'catalog.design')
                && request()->route('category') === ($params['category'] ?? null)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array{route: string, active?: array<int, string>}  $item
     */
    public static function navLinkClass(array $item, string $inactive, string $active): string
    {
        $patterns = $item['active'] ?? [$item['route']];

        return self::isActive($patterns) ? $active : $inactive;
    }

    /**
     * @param  array{route?: string, params?: array<string, mixed>, href?: string}  $item
     */
    public static function itemHref(array $item): string
    {
        if (filled($item['href'] ?? null)) {
            return (string) $item['href'];
        }

        $route = $item['route'] ?? 'home';
        $params = is_array($item['params'] ?? null) ? $item['params'] : [];
        [$route, $params] = self::canonicalRoute($route, $params);

        return route($route, $params);
    }

    /**
     * Convert legacy category route names and query taxonomy into canonical path routes.
     *
     * @param  array<string, mixed>  $params
     * @return array{0: string, 1: array<string, mixed>}
     */
    public static function canonicalRoute(string $route, array $params = []): array
    {
        $category = match ($route) {
            'catalog.windows' => 'WINDOW',
            'catalog.doors' => 'DOOR',
            'catalog.bouven' => 'BOUVEN',
            default => null,
        };

        if ($category === null) {
            return [$route, $params];
        }

        $model = CatalogLabels::normalizeModel($params['model'] ?? null);
        $design = CatalogLabels::normalizeDesign($params['design'] ?? null);
        unset($params['model'], $params['design']);

        $path = ['category' => CategoryUrl::categoryToSlug($category)];
        $target = 'catalog.category';

        if (filled($model)) {
            $path['model'] = strtolower(str_replace('_', '-', $model));
            $target = 'catalog.model';
        }

        if (filled($model) && filled($design)) {
            $path['design'] = strtolower(str_replace('_', '-', $design));
            $target = 'catalog.design';
        }

        return [$target, array_merge($path, $params)];
    }

    /** @param array<string, mixed> $params */
    public static function canonicalHref(string $route, array $params = [], bool $absolute = true): string
    {
        [$route, $params] = self::canonicalRoute($route, $params);

        return route($route, $params, $absolute);
    }

    /**
     * @param  array{route?: string, active?: array<int, string>}  $item
     */
    public static function itemIsActive(array $item): bool
    {
        $patterns = $item['active'] ?? [($item['route'] ?? 'home')];

        return self::isActive($patterns);
    }
}
