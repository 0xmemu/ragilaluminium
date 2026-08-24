<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifikasi kredensial webhook Baileys (gateway WhatsApp) SEBELUM request diproses.
 *
 * Mendukung mode:
 *  - HMAC: header X-Webhook-Hmac (+ X-Webhook-Hmac-Algorithm sha256|sha512) atas body mentah.
 *  - Plain secret: X-Webhook-Secret / X-BAILEYS-Secret.
 *  - Alias: X-Api-Key (nilai sama dengan webhook_secret).
 *  - Escape hatch unsigned: HANYA non-production + allow_unsigned_webhooks=true.
 *
 * Invalid/missing -> 403 (konsisten dengan kontrak test WhatsAppWebhookSecurityTest).
 */
class VerifyBaileysKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('services.whatsapp.baileys.webhook_secret', '');

        if ($secret === '') {
            if ($this->unsignedWebhooksAllowed($request)) {
                return $next($request);
            }

            abort(403, 'Baileys webhook secret not configured');
        }

        if (! $this->secretValid($request, $secret)) {
            abort(403, 'Invalid Baileys webhook secret');
        }

        return $next($request);
    }

    protected function secretValid(Request $request, string $secret): bool
    {
        // HMAC body mentah (mode BAILEYS): header X-Webhook-Hmac.
        $hmac = $request->header('X-Webhook-Hmac');
        if (is_string($hmac) && $hmac !== '') {
            $algo = strtolower(trim((string) $request->header('X-Webhook-Hmac-Algorithm', 'sha512')));
            if (! in_array($algo, ['sha256', 'sha512'], true)) {
                $algo = 'sha512';
            }
            $expected = hash_hmac($algo, $request->getContent(), $secret);

            return hash_equals($expected, strtolower(trim($hmac)));
        }

        // Plain secret via header (query-string selalu ditolak).
        $provided = $request->header('X-Webhook-Secret')
            ?? $request->header('X-BAILEYS-Secret')
            ?? $request->header('X-Api-Key');

        return is_string($provided) && hash_equals($secret, $provided);
    }

    protected function unsignedWebhooksAllowed(Request $request): bool
    {
        // Tidak pernah diizinkan di production, apa pun config-nya.
        if (app()->environment('production')) {
            return false;
        }

        return (bool) config('services.whatsapp.allow_unsigned_webhooks', false);
    }
}