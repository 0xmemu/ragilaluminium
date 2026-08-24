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
        // Verifikasi kredensial ditangani middleware verify.baileys.key (401/403).
        $this->whatsapp->handleBaileysWebhook($request->all());

        return response('OK', 200);
    }
}