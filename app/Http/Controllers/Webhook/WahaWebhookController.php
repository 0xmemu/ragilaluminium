<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * WAHA Events webhook — HMAC-SHA512 of raw body (X-Webhook-Hmac).
 *
 * @see https://waha.devlike.pro/docs/how-to/events/
 */
class WahaWebhookController extends Controller
{
    public function __construct(protected WhatsAppService $whatsapp) {}

    public function __invoke(Request $request): Response
    {
        if (! $this->hmacValid($request)) {
            return response('Invalid WAHA HMAC', 403);
        }

        $this->whatsapp->handleWahaWebhook($request->all());

        return response('OK', 200);
    }

    protected function hmacValid(Request $request): bool
    {
        $secret = (string) config('services.whatsapp.waha.hmac_secret', '');
        if ($secret === '') {
            return false;
        }

        $header = $request->header('X-Webhook-Hmac', '');
        if (! is_string($header) || $header === '') {
            return false;
        }

        $algorithm = strtolower((string) $request->header('X-Webhook-Hmac-Algorithm', ''));
        if ($algorithm !== 'sha512') {
            return false;
        }

        $expected = hash_hmac('sha512', $request->getContent(), $secret);

        return hash_equals($expected, $header);
    }
}
