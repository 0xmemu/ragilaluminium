<?php

namespace App\Support;

use App\Models\User;

/**
 * Admin Capability Contract (Foundation Track A).
 *
 * Sumber kebenaran authorization = guard existing (middleware `admin` /
 * EnsureUserIsAdmin + User::isAdmin()). Tidak ada policy/gate granular saat ini
 * (equal-admin stage 2), sehingga capability mencerminkan fakta: true hanya bila
 * user adalah admin aktif (semua area admin), false untuk non-admin.
 *
 * - BUKAN security: server action tetap wajib authorization sendiri.
 * - Capability frontend hanya utk visibility/disabled state (UX).
 * - granular=false menandakan belum ada permission granular backend;
 *   capability namespace siap dipetakan ke policy di masa depan.
 */
class AdminCapabilities
{
    public const VERSION = 1;

    /** Capability namespace stabil (domain → capability). */
    public const NAMESPACE = [
        'dashboard' => ['view'],
        'analytics' => ['view'],
        'orders' => ['view', 'process', 'cancel', 'export'],
        'payments' => ['view', 'manage'],
        'shipping' => ['view', 'manage', 'refresh'],
        'returns' => ['view', 'create', 'complete', 'refund', 'replacement'],
        'products' => ['view', 'manage', 'publish', 'media'],
        'promotions' => ['view', 'manage'],
        'cod_settings' => ['view', 'manage'],
        'customers' => ['view', 'manage'],
        'testimonials' => ['view', 'manage'],
        'whatsapp' => ['view', 'send', 'manage_connection'],
        'storefront_content' => ['view', 'manage'],
        'activity_logs' => ['view'],
        'notifications' => ['view', 'manage'],
        'profile' => ['view', 'manage'],
        'users' => ['view', 'manage'],
        'settings' => ['view', 'manage'],
        'integrations' => ['view', 'manage'],
    ];

    /**
     * Semua capability id "domain.action".
     *
     * @return list<string>
     */
    public static function all(): array
    {
        $all = [];
        foreach (self::NAMESPACE as $domain => $actions) {
            foreach ($actions as $action) {
                $all[] = $domain.'.'.$action;
            }
        }

        return $all;
    }

    /**
     * Map capability utk user aktif.
     *
     * Guard existing hanya membedakan admin vs non-admin. Semua capability
     * = isAdmin() (true) atau false. granular=false (belum ada permission
     * granular backend).
     *
     * @return array{version: int, granular: bool, capabilities: array<string, bool>}
     */
    public static function for(?User $user): array
    {
        $isAdmin = $user?->isAdmin() ?? false;

        $capabilities = [];
        foreach (self::all() as $capability) {
            $capabilities[$capability] = $isAdmin;
        }

        return [
            'version' => self::VERSION,
            'granular' => false,
            'capabilities' => $capabilities,
        ];
    }
}
