<?php

namespace App\Support;

use App\Services\Shipping\JntCargoClient;

/**
 * Checklist aktivasi J&T Cargo Open Platform (bukan aggregator / Biteship).
 */
class JntReadiness
{
    public const PROVIDER = 'jnt_cargo_open_platform';

    /**
     * @return array{
     *   provider: string,
     *   provider_label: string,
     *   environment: string,
     *   base_url: string,
     *   enabled_flag: bool,
     *   client_ready: bool,
     *   missing: list<string>,
     *   checks: array<string, bool>
     * }
     */
    public static function report(?JntCargoClient $client = null): array
    {
        $client ??= app(JntCargoClient::class);

        $checks = [
            'JNT_ENABLED' => (bool) config('jnt.enabled'),
            'JNT_API_ACCOUNT' => filled(config('jnt.credentials.api_account')),
            'JNT_PRIVATE_KEY' => filled(config('jnt.credentials.private_key')),
            'JNT_WEBHOOK_PRIVATE_KEY' => filled(config('jnt.webhook.private_key')),
            'JNT_CUSTOMER_CODE' => filled(config('jnt.credentials.customer_code')),
            'JNT_CUSTOMER_PASSWORD' => filled(config('jnt.credentials.customer_password')),
            'JNT_SENDER_MOBILE' => filled(config('jnt.sender.mobile')),
            'JNT_SENDER_PROV' => filled(config('jnt.sender.prov')),
            'JNT_SENDER_CITY' => filled(config('jnt.sender.city')),
            'JNT_SENDER_AREA' => filled(config('jnt.sender.area')),
            'JNT_SENDER_ADDRESS' => filled(config('jnt.sender.address')),
            'JNT_SENDER_POSTCODE' => filled(config('jnt.sender.postcode')),
        ];

        $missing = [];
        foreach ($checks as $key => $ok) {
            if (! $ok) {
                $missing[] = $key;
            }
        }

        return [
            'provider' => self::PROVIDER,
            'provider_label' => 'J&T Cargo Open Platform',
            'environment' => $client->environment(),
            'base_url' => $client->baseUrl(),
            'enabled_flag' => (bool) config('jnt.enabled'),
            'client_ready' => $client->isEnabled(),
            'missing' => $missing,
            'checks' => $checks,
        ];
    }
}
