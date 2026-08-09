<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WhatsAppController extends Controller
{
    public function __construct(protected WhatsAppService $whatsapp) {}

    public function verify(Request $request): Response
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        if ($mode === 'subscribe' && $token === config('services.whatsapp.meta.verify_token')) {
            return response($challenge, 200);
        }

        return response('Forbidden', 403);
    }

    public function handle(Request $request): Response
    {
        if (! $this->signatureValid($request)) {
            return response('Invalid signature', 403);
        }

        $this->whatsapp->handleMetaWebhook($request->all());

        return response('OK', 200);
    }

    public function handleWaha(Request $request): Response
    {
        if (! $this->wahaSecretValid($request)) {
            return response('Invalid WAHA secret', 403);
        }

        $this->whatsapp->handleWahaWebhook($request->all());

        return response('OK', 200);
    }

    /**
     * Verifikasi X-Hub-Signature-256 dari Meta (HMAC-SHA256 body mentah dengan
     * app secret). Unsigned request hanya boleh lewat flag eksplisit non-production.
     */
    protected function signatureValid(Request $request): bool
    {
        $secret = config('services.whatsapp.app_secret');
        if (! $secret) {
            return $this->unsignedWebhooksAllowed();
        }

        $header = $request->header('X-Hub-Signature-256', '');
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);

        return is_string($header) && hash_equals($expected, $header);
    }

    protected function wahaSecretValid(Request $request): bool
    {
        $secret = config('services.whatsapp.waha.webhook_secret');
        if (! $secret) {
            return $this->unsignedWebhooksAllowed();
        }

        // WAHA mode HMAC: header X-Webhook-Hmac berisi hex HMAC dari body mentah.
        // Algoritma ditentukan header X-Webhook-Hmac-Algorithm (WAHA kirim 'sha512').
        $hmac = $request->header('X-Webhook-Hmac');
        if (is_string($hmac) && $hmac !== '') {
            $algo = strtolower(trim((string) $request->header('X-Webhook-Hmac-Algorithm', 'sha512')));
            if (! in_array($algo, ['sha256', 'sha512'], true)) {
                $algo = 'sha512';
            }
            $expected = hash_hmac($algo, $request->getContent(), $secret);

            return hash_equals($expected, strtolower(trim($hmac)));
        }

        // WAHA mode plain secret: X-Webhook-Secret / X-WAHA-Secret (query-string ditolak).
        $provided = $request->header('X-Webhook-Secret')
            ?? $request->header('X-WAHA-Secret');

        return is_string($provided) && hash_equals($secret, $provided);
    }

    protected function unsignedWebhooksAllowed(): bool
    {
        return ! app()->environment('production')
            && (bool) config('services.whatsapp.allow_unsigned_webhooks', false);
    }
}
