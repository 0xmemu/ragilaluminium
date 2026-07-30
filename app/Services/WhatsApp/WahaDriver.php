<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * WAHA REST client (GOWS/NOWEB). Anti-ban flow per waha.devlike.pro "How to Avoid Blocking".
 */
class WahaDriver implements WhatsAppDriver
{
    public const CACHE_SESSION_STATUS = 'waha.session.status';

    public const CACHE_TIMELOCK = 'waha.session.timelock_until';

    public function name(): string
    {
        return 'waha';
    }

    public function configured(): bool
    {
        return filled(config('services.whatsapp.waha.base_url'))
            && filled(config('services.whatsapp.waha.api_key'));
    }

    public function sendText(string $phone, string $text): array
    {
        return $this->sendHumanizedText($phone, $text, markSeen: false);
    }

    public function sendTemplate(string $phone, string $templateName, string $languageCode, array $variables, ?string $renderedBody = null): array
    {
        $body = $renderedBody;
        if ($body === null || trim($body) === '') {
            $body = implode("\n", array_map(static fn ($v) => (string) $v, $variables));
        }

        return $this->sendHumanizedText($phone, $body, markSeen: false);
    }

    public function sendImage(string $phone, string $imageUrl, ?string $caption = null): array
    {
        if ($this->timelockActive()) {
            return $this->deferredResult('Reachout timelock aktif; tunda kirim gambar.');
        }

        $chatId = $this->checkExists($phone);
        if ($chatId === null) {
            return $this->failResult('Nomor tidak terdaftar WhatsApp.', ['phone' => $phone]);
        }

        if (! $this->acquireRateSlot()) {
            return $this->deferredResult('Rate limit WAHA (~8 pesan/menit).');
        }

        $session = $this->session();
        $payload = [
            'session' => $session,
            'chatId' => $chatId,
            'file' => ['url' => $imageUrl],
        ];
        if ($caption !== null && $caption !== '') {
            $payload['caption'] = $caption;
        }

        return $this->postJson('/api/sendImage', $payload, $chatId);
    }

    public function checkExists(string $phone): ?string
    {
        $phone = preg_replace('/\D+/', '', $phone) ?? $phone;
        $cacheKey = 'waha.chat_id.'.$phone;
        $cached = Cache::get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        try {
            $response = $this->client()
                ->get('/api/contacts/check-exists', [
                    'phone' => $phone,
                    'session' => $this->session(),
                ]);

            if (! $response->successful()) {
                Log::warning('WAHA check-exists failed', [
                    'phone' => $phone,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $exists = (bool) ($response->json('numberExists') ?? false);
            if (! $exists) {
                return null;
            }

            $chatId = $this->normalizeChatId(
                (string) ($response->json('chatId') ?? ($phone.'@c.us'))
            );

            Cache::put($cacheKey, $chatId, now()->addDays(7));

            return $chatId;
        } catch (\Throwable $e) {
            Log::warning('WAHA check-exists exception', ['phone' => $phone, 'error' => $e->getMessage()]);

            return null;
        }
    }

    public function startTyping(string $chatId): void
    {
        $this->postJson('/api/startTyping', [
            'session' => $this->session(),
            'chatId' => $chatId,
        ], $chatId, swallow: true);
    }

    public function stopTyping(string $chatId): void
    {
        $this->postJson('/api/stopTyping', [
            'session' => $this->session(),
            'chatId' => $chatId,
        ], $chatId, swallow: true);
    }

    public function sendSeen(string $chatId): void
    {
        $this->postJson('/api/sendSeen', [
            'session' => $this->session(),
            'chatId' => $chatId,
        ], $chatId, swallow: true);
    }

    /**
     * Humanized outbound text: check-exists → typing → delay → sendText.
     *
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed,
     *   chat_id?: ?string
     * }
     */
    public function sendHumanizedText(string $phone, string $text, bool $markSeen = false): array
    {
        if ($this->timelockActive()) {
            return $this->deferredResult('Reachout timelock aktif; jangan logout/restart sesi.');
        }

        $chatId = $this->checkExists($phone);
        if ($chatId === null) {
            return $this->failResult('Nomor tidak terdaftar WhatsApp.', ['phone' => $phone]);
        }

        if (! $this->acquireRateSlot()) {
            return $this->deferredResult('Rate limit WAHA (~8 pesan/menit).');
        }

        if ($markSeen) {
            $this->sendSeen($chatId);
        }

        $this->startTyping($chatId);
        $this->humanDelay(strlen($text));
        $this->stopTyping($chatId);

        $result = $this->postJson('/api/sendText', [
            'session' => $this->session(),
            'chatId' => $chatId,
            'text' => $text,
        ], $chatId);

        if ($this->isReachoutTimelock($result)) {
            $this->markTimelock(now()->addHour());

            return $this->deferredResult(
                'Reachout Timelock (463): biarkan sesi WORKING, retry nanti.',
                $result['raw_payload'] ?? null,
                $chatId,
            );
        }

        return $result;
    }

    public function sessionStatus(): ?string
    {
        $status = Cache::get(self::CACHE_SESSION_STATUS);

        return is_string($status) ? $status : null;
    }

    public function timelockActive(): bool
    {
        $until = Cache::get(self::CACHE_TIMELOCK);
        if (! $until) {
            return false;
        }

        try {
            return now()->lt(\Illuminate\Support\Carbon::parse($until));
        } catch (\Throwable) {
            return false;
        }
    }

    public function markTimelock(\DateTimeInterface $until): void
    {
        Cache::put(self::CACHE_TIMELOCK, $until->format(\DateTimeInterface::ATOM), $until);
    }

    public function rememberSessionStatus(string $status, mixed $data = null): void
    {
        Cache::put(self::CACHE_SESSION_STATUS, $status, now()->addDays(7));
        Cache::put(self::CACHE_SESSION_STATUS.'.data', $data, now()->addDays(7));

        if (in_array($status, ['FAILED', 'SCAN_QR_CODE'], true)) {
            Log::critical('WAHA session needs attention', [
                'status' => $status,
                'session' => $this->session(),
                'data' => $data,
            ]);
        }

        if ($status === 'WORKING' && is_array($data) && $this->dataLooksLikeTimelock($data)) {
            $this->markTimelock(now()->addHour());
            Log::warning('WAHA reachout timelock detected via session.status', [
                'session' => $this->session(),
                'data' => $data,
            ]);
        }
    }

    /**
     * Convert GOWS/NOWEB ids (`…@s.whatsapp.net`) to WAHA chatId (`…@c.us`).
     */
    public function normalizeChatId(string $chatId): string
    {
        $chatId = trim($chatId);
        if (str_ends_with($chatId, '@s.whatsapp.net')) {
            return preg_replace('/@s\.whatsapp\.net$/', '@c.us', $chatId) ?? ($chatId);
        }

        if (! str_contains($chatId, '@')) {
            return $chatId.'@c.us';
        }

        return $chatId;
    }

    protected function humanDelay(int $textLength): void
    {
        if (app()->environment('testing')) {
            return;
        }

        $seconds = min(4.0, 1.0 + ($textLength / 60));
        $jitter = mt_rand(0, 500) / 1000;
        $total = $seconds + $jitter;

        usleep((int) round($total * 1_000_000));
    }

    protected function acquireRateSlot(): bool
    {
        $key = 'waha-send:'.$this->session();

        return RateLimiter::attempt($key, 8, fn () => true, 60);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed,
     *   chat_id?: ?string
     * }
     */
    protected function postJson(string $path, array $payload, ?string $chatId = null, bool $swallow = false): array
    {
        try {
            $response = $this->client()
                ->post($path, $payload);

            $result = [
                'successful' => $response->successful(),
                'provider_message_id' => $response->json('id')
                    ?? $response->json('message.id')
                    ?? $response->json('messageId'),
                'provider_session' => $this->session(),
                'status' => $response->successful() ? 'sent' : 'failed',
                'error_reason' => $response->successful() ? null : $response->body(),
                'raw_payload' => $response->json() ?: ['body' => $response->body()],
                'chat_id' => $chatId,
            ];

            if ($swallow) {
                return $result;
            }

            return $result;
        } catch (\Throwable $e) {
            $result = [
                'successful' => false,
                'provider_message_id' => null,
                'provider_session' => $this->session(),
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'raw_payload' => null,
                'chat_id' => $chatId,
            ];

            if ($swallow) {
                Log::debug('WAHA soft call failed', ['path' => $path, 'error' => $e->getMessage()]);
            }

            return $result;
        }
    }

    protected function client(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::withHeaders([
            'X-Api-Key' => (string) config('services.whatsapp.waha.api_key'),
        ])
            ->baseUrl(rtrim((string) config('services.whatsapp.waha.base_url'), '/'))
            ->timeout((int) config('services.whatsapp.waha.timeout', 10))
            ->retry(2, 500, throw: false)
            ->acceptJson();
    }

    protected function session(): string
    {
        return (string) config('services.whatsapp.waha.session', 'default');
    }

    /**
     * @param  array<string, mixed>  $result
     */
    protected function isReachoutTimelock(array $result): bool
    {
        if ($result['successful'] ?? false) {
            return false;
        }

        $blob = strtolower(json_encode($result['raw_payload'] ?? []).' '.($result['error_reason'] ?? ''));

        return str_contains($blob, '463')
            || str_contains($blob, 'timelock')
            || str_contains($blob, 'reachout');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function dataLooksLikeTimelock(array $data): bool
    {
        $blob = strtolower(json_encode($data) ?: '');

        return str_contains($blob, 'timelock') || str_contains($blob, '463') || str_contains($blob, 'reachout');
    }

    /**
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed,
     *   chat_id?: ?string
     * }
     */
    protected function deferredResult(string $reason, mixed $raw = null, ?string $chatId = null): array
    {
        return [
            'successful' => false,
            'provider_message_id' => null,
            'provider_session' => $this->session(),
            'status' => 'deferred',
            'error_reason' => $reason,
            'raw_payload' => $raw,
            'chat_id' => $chatId,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $raw
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed
     * }
     */
    protected function failResult(string $reason, mixed $raw = null): array
    {
        return [
            'successful' => false,
            'provider_message_id' => null,
            'provider_session' => $this->session(),
            'status' => 'failed',
            'error_reason' => $reason,
            'raw_payload' => $raw,
        ];
    }
}
