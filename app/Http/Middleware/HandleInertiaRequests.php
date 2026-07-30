<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $cartCount = 0;
        $modelMenu = [];
        try {
            $cartCount = app(\App\Services\CartService::class)->count();
        } catch (\Throwable) {
            $cart = session('ragil_cart', session('cart', []));
            $cartCount = is_array($cart)
                ? collect($cart)->sum(fn ($row) => (int) ($row['quantity'] ?? $row['qty'] ?? 0))
                : 0;
        }

        try {
            $modelMenu = collect(app(\App\Services\ModelProductService::class)->storefrontCards())
                ->map(fn (array $model) => [
                    'label' => $model['title'],
                    'href' => $model['href'],
                    'category' => $model['category'],
                ])
                ->values()
                ->all();
        } catch (\Throwable) {
            // Navigation remains usable while catalog storage is unavailable.
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user()
                    ? [
                        'id' => $request->user()->id,
                        'name' => $request->user()->name,
                        'email' => $request->user()->email,
                    ]
                    : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'status' => fn () => $request->session()->get('status'),
            ],
            'cartCount' => $cartCount,
            'cartPreview' => fn () => $this->cartPreview(),
            'brand' => [
                'name' => config('sitemap.brand.name', config('app.name')),
                'short_name' => config('sitemap.brand.short_name', 'Ragil Aluminium'),
                'tagline' => config('sitemap.brand.tagline', ''),
                'email' => config('sitemap.brand.email', ''),
                'phone' => \App\Support\ConsultationWhatsApp::displayPhone(),
                'address' => config('sitemap.brand.address', ''),
                'hours' => config('sitemap.brand.hours', 'Senin – Sabtu, 08.00 – 17.00 WIB'),
                'maps_url' => (static function (): ?string {
                    $explicit = trim((string) config('sitemap.brand.maps_url', ''));
                    if ($explicit !== '') {
                        return $explicit;
                    }
                    $query = trim((string) config('sitemap.brand.maps_query', ''));
                    if ($query === '') {
                        $query = trim((string) config('sitemap.brand.address', ''));
                    }
                    if ($query === '') {
                        return null;
                    }

                    return 'https://www.google.com/maps/search/?api=1&query='.rawurlencode($query);
                })(),
                'maps_embed_url' => (static function (): ?string {
                    $query = trim((string) config('sitemap.brand.maps_query', ''));
                    if ($query === '') {
                        $query = trim((string) config('sitemap.brand.address', ''));
                    }
                    if ($query === '') {
                        return null;
                    }

                    return 'https://maps.google.com/maps?q='.rawurlencode($query).'&z=16&output=embed';
                })(),
                'units_installed_label' => config(
                    'sitemap.brand.units_installed_label',
                    '1.000.000+ Unit Terpasang di Seluruh Indonesia'
                ),
                'years_experience_label' => config(
                    'sitemap.brand.years_experience_label',
                    '15+ Tahun Pengalaman'
                ),
            ],
            'announcements' => \App\Support\ActiveAnnouncements::items(),
            'flashSalePeriod' => fn () => \App\Support\FlashSalePeriodSettings::publicState(),
            'footer' => config('sitemap.footer', []),
            'platforms' => \App\Support\StorefrontPlatformSettings::forStorefront(),
            'nav' => fn () => $this->sharedNavigation($modelMenu),
            'csrf' => csrf_token(),
            'consultationWhatsApp' => fn () => \App\Support\ConsultationWhatsApp::sharedProps(),
        ];
    }

    /**
     * Nav publik + merge hamburger untuk kompatibilitas props lama.
     *
     * @param  array<int, array<string, mixed>>  $modelMenu
     * @return array{public: array<string, mixed>, admin: mixed}
     */
    protected function sharedNavigation(array $modelMenu): array
    {
        $navigation = config('sitemap.navigation', []);
        $product = $navigation['hamburger_product'] ?? [];
        $info = $navigation['hamburger_info'] ?? [];

        return [
            'public' => [
                ...$navigation,
                'hamburger' => array_values(array_merge($product, $info)),
                'model_menu' => $modelMenu,
            ],
            'admin' => config('admin-sitemap.navigation', []),
        ];
    }

    /**
     * Ringkasan isi keranjang untuk hover preview header (maks 5 baris).
     */
    protected function cartPreview(): array
    {
        try {
            $priced = app(\App\Services\CartService::class)->pricedLines();

            return collect($priced['items'])->take(5)->map(function (array $item) {
                return [
                    'line_id' => $item['line_id'],
                    'parent_sku' => $item['parent_sku'],
                    'name' => $item['name'],
                    'variation' => collect([
                        $item['variation_1_option'] ?? null,
                        $item['variation_2_option'] ?? null,
                    ])->filter()->implode(', '),
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => (float) $item['unit_price'],
                    'image' => $item['image'] ?? null,
                ];
            })->all();
        } catch (\Throwable) {
            return [];
        }
    }
}
