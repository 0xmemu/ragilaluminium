<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
            $modelMenu = Cache::remember('storefront:model-menu:v1', now()->addMinutes(2), function (): array {
                return collect(app(\App\Services\ModelProductService::class)->storefrontCards())
                    ->map(fn (array $model) => [
                        'label' => $model['title'],
                        'href' => $model['href'],
                        'category' => $model['category'],
                    ])
                    ->values()
                    ->all();
            });
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
            'adminNotificationCount' => fn () => $request->user()
                ? (int) \App\Models\AdminNotification::unread()->count()
                : 0,
            'adminNotifications' => fn () => $request->user()
                ? \App\Models\AdminNotification::query()
                    ->latest('id')
                    ->limit(12)
                    ->get()
                    ->map(fn ($n) => [
                        'id' => $n->id,
                        'type' => $n->type,
                        'title' => $n->title,
                        'body' => $n->body,
                        'href' => $n->href,
                        'read_at' => $n->read_at?->toIso8601String(),
                        'created_at' => $n->created_at?->toIso8601String(),
                        'created_at_label' => $n->created_at?->locale('id')->diffForHumans(),
                    ])
                    ->all()
                : [],
            'adminActivityLogs' => fn () => $request->user()
                ? \App\Models\EventLog::query()
                    ->with('createdBy')
                    ->latest('id')
                    ->limit(8)
                    ->get()
                    ->map(fn ($log) => [
                        'id' => $log->id,
                        'event_type' => $log->event_type,
                        'entity_type' => $log->entity_type,
                        'created_at' => optional($log->created_at)?->toIso8601String(),
                        'created_at_label' => optional($log->created_at)?->locale('id')->diffForHumans(),
                        'actor' => optional($log->createdBy)->name ?? 'Sistem',
                    ])
                    ->all()
                : [],
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


}
