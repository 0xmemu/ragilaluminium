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
            'provider' => $service->connectionStatus()['default_provider'],
        ]);
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

            return response()->json($response->json() ?? [
                'status' => 'unknown',
                'statusText' => 'Balasan gateway tidak terbaca',
                'phone' => '',
            ]);
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

    public function code(Request $request): JsonResponse
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
                return response()->json([
                    'error' => $response->json('error') ?? 'Gagal membuat pairing code.',
                    'status' => $response->json('status') ?? 'unknown',
                ], $response->status() >= 400 ? $response->status() : 422);
            }

            return response()->json([
                'code' => $response->json('code'),
                'status' => $response->json('status'),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Gateway tidak dapat dijangkau: '.$e->getMessage()], 502);
        }
    }
}
