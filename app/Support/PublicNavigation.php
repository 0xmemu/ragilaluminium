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

        return route($route, $params);
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
