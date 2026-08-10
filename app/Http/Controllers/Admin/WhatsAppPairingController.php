<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class WhatsAppPairingController extends Controller
{
    protected function baseUrl(): string
    {
        return rtrim((string) config('services.whatsapp.baileys.base_url'), '/');
    }

    protected function headers(): array
    {
        return ['X-Api-Key' => (string) config('services.whatsapp.baileys.api_key')];
    }

    public function show(): Response
    {
        $service = app(WhatsAppService::class);

        return Inertia::render('Admin/WhatsApp/Pairing', [
            'title' => 'Pairing WhatsApp',
            'description' => 'Hubungkan gateway WhatsApp (Baileys) ke nomor Anda lewat scan QR atau pairing code.',
            'backUrl' => route('admin.whatsapp.connection'),
            'statusUrl' => route('admin.whatsapp.pairing.status'),
            'qrUrl' => route('admin.whatsapp.pairing.qr'),
            'codeUrl' => route('admin.whatsapp.pairing.code'),
            'refreshQrUrl' => route('admin.whatsapp.pairing.refresh-qr'),
            'provider' => $service->connectionStatus()['default_provider'],
            'flash' => [
                'success' => session('whatsapp_success'),
                'error' => session('whatsapp_error'),
                'code' => session('whatsapp_code'),
            ],
        ]);
    }

    protected function sessionInfo(bool $connected): array
    {
        // Only a truly connected (open) gateway has a linked device. A creds file
        // with a `me.id` does NOT mean the device was linked — requestPairingCode
        // writes it before pairing completes. So report the number only when open.
        if (! $connected) {
            return ['has_session' => false, 'connected_phone' => null, 'session_name' => null];
        }

        $path = '/opt/baileys-bot/session/creds.json';
        if (! is_file($path)) {
            return ['has_session' => false, 'connected_phone' => null, 'session_name' => null];
        }

        try {
            $data = json_decode((string) file_get_contents($path), true);
            $me = $data['me'] ?? null;
            $id = is_array($me) ? ($me['id'] ?? null) : null;
            $phone = $id ? (string) preg_replace('/@.+$/', '', (string) $id) : null;

            return [
                'has_session' => filled($phone),
                'connected_phone' => $phone,
                'session_name' => is_array($me) ? ($me['name'] ?? null) : null,
            ];
        } catch (\Throwable $e) {
            return ['has_session' => false, 'connected_phone' => null, 'session_name' => null];
        }
    }

    public function status(): JsonResponse
    {
        try {
            $response = Http::timeout(5)->get($this->baseUrl().'/status');

            if ($response->failed()) {
                return response()->json([
                    'status' => 'unreachable',
                    'statusText' => 'Gateway tidak merespons ('.(string) $response->status().')',
                    'phone' => '',
                ]);
            }

            $payload = $response->json() ?? [
                'status' => 'unknown',
                'statusText' => 'Balasan gateway tidak terbaca',
                'phone' => '',
            ];

            $connected = (($payload['status'] ?? '') === 'open');
            return response()->json(array_merge($payload, $this->sessionInfo($connected)));
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'unreachable',
                'statusText' => 'Gateway tidak dapat dijangkau',
                'phone' => '',
            ]);
        }
    }

    public function qr(): SymfonyResponse
    {
        $response = Http::timeout(5)->get($this->baseUrl().'/qr.png');

        if ($response->failed()) {
            abort(404, 'QR belum tersedia');
        }

        return response($response->body(), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function refreshQr(): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
    {
        try {
            $response = Http::timeout(10)
                ->withHeaders($this->headers())
                ->post($this->baseUrl().'/api/refresh-qr');

            if ($response->failed()) {
                return back()->with('whatsapp_error', $response->json('error') ?? 'Gagal membuat QR baru.');
            }

            return back()->with('whatsapp_success', 'Membuat QR baru... Scan dalam beberapa detik.');
        } catch (\Throwable $e) {
            return back()->with('whatsapp_error', 'Gateway tidak dapat dijangkau.');
        }
    }

    public function code(Request $request): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $phone = preg_replace('/[^0-9]/', '', (string) $validated['phone']);
        if ($phone === '') {
            return response()->json(['error' => 'Nomor WhatsApp tidak valid.'], 422);
        }

        try {
            $response = Http::timeout(20)
                ->withHeaders($this->headers())
                ->post($this->baseUrl().'/pairing-code', ['phone' => $phone]);

            if ($response->failed()) {
                return back()->with('whatsapp_error', $response->json('error') ?? 'Gagal membuat pairing code.');
            }

            return back()->with('whatsapp_code', (string) $response->json('code'));
        } catch (\Throwable $e) {
            return back()->with('whatsapp_error', 'Gateway tidak dapat dijangkau.');
        }
    }
}
