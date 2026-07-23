<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WhatsAppController extends Controller
{
    public function __construct(protected WhatsAppService $whatsapp)
    {
    }

    public function verify(Request $request): Response
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        if ($mode === 'subscribe' && $token === config('services.whatsapp.verify_token')) {
            return response($challenge, 200);
        }

        return response('Forbidden', 403);
    }

    public function handle(Request $request): Response
    {
        if (! $this->signatureValid($request)) {
            return response('Invalid signature', 403);
        }

        $this->whatsapp->handleWebhook($request->all());

        return response('OK', 200);
    }

    /**
     * Verifikasi X-Hub-Signature-256 dari Meta (HMAC-SHA256 body mentah dengan
     * app secret). Dilewati hanya jika app_secret tidak dikonfigurasi (dev).
     */
    protected function signatureValid(Request $request): bool
    {
        $secret = config('services.whatsapp.app_secret');
        if (! $secret) {
            return true;
        }

        $header = $request->header('X-Hub-Signature-256', '');
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);

        return is_string($header) && hash_equals($expected, $header);
    }
}
