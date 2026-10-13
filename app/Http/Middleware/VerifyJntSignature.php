<?php

namespace App\Http\Middleware;

use App\Services\Shipping\JntCargoClient;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifikasi signature webhook J&T Open Platform (header digest = md5(bizContent+key)
 * dalam base64 atau hex) SEBELUM request diproses. Invalid -> 401 (J&T akan retry).
 *
 * @see config('jnt.webhook')
 */
class VerifyJntSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $rawJson = (string) $request->input('bizContent');
        $signature = $request->header(
            (string) config('jnt.webhook.signature_header', 'digest'),
        ) ?? $request->input('digest');

        if (! app(JntCargoClient::class)->verifyWebhookSignature($rawJson, $signature)) {
            abort(401, 'Invalid J&T webhook signature');
        }

        return $next($request);
    }
}