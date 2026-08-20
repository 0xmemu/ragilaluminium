<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WhatsAppController extends Controller
{
    public function __construct(protected WhatsAppService $whatsapp) {}

    public function handleBaileys(Request $request): Response
    {
        if (! $this->baileysSecretValid($request)) {
            return response('Invalid BAILEYS secret', 403);
        }

        $this->whatsapp->handleBaileysWebhook($request->all());

        return response('OK', 200);
    }

    protected function baileysSecretValid(Request $request): bool
    {
        $secret = config('services.whatsapp.baileys.webhook_secret');
        if (! $secret) {
            return $this->unsignedWebhooksAllowed();
        }

        // BAILEYS mode HMAC: header X-Webhook-Hmac berisi hex HMAC dari body mentah.
        // Algoritma ditentukan header X-Webhook-Hmac-Algorithm (BAILEYS kirim 'sha512').
        $hmac = $request->header('X-Webhook-Hmac');
        if (is_string($hmac) && $hmac !== '') {
            $algo = strtolower(trim((string) $request->header('X-Webhook-Hmac-Algorithm', 'sha512')));
            if (! in_array($algo, ['sha256', 'sha512'], true)) {
                $algo = 'sha512';
            }
            $expected = hash_hmac($algo, $request->getContent(), $secret);

            return hash_equals($expected, strtolower(trim($hmac)));
        }

        // BAILEYS mode plain secret: X-Webhook-Secret / X-BAILEYS-Secret (query-string ditolak).
        $provided = $request->header('X-Webhook-Secret')
            ?? $request->header('X-BAILEYS-Secret');

        return is_string($provided) && hash_equals($secret, $provided);
    }

    protected function unsignedWebhooksAllowed(): bool
    {
        return ! app()->environment('production')
            && (bool) config('services.whatsapp.allow_unsigned_webhooks', false);
    }
}
