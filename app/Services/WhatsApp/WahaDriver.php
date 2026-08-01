<?php

namespace App\Services\WhatsApp;

use App\Services\ActivityLogService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

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
            && filled(config('services.whatsapp.waha.api_key'))
            && filled(config('services.whatsapp.waha.hmac_secret'));
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

        $recipient = $this->resolveRecipient($phone);
        if ($recipient['chat_id'] === null) {
            return $recipient['retryable']
                ? $this->deferredResult($recipient['reason'], $recipient['raw'])
                : $this->failResult($recipient['reason'], $recipient['raw']);
        }
        $chatId = $recipient['chat_id'];

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
        return $this->resolveRecipient($phone)['chat_id'];
    }

    /**
     * @return array{chat_id: ?string, retryable: bool, reason: string, raw: mixed}
     */
    protected function resolveRecipient(string $phone): array
    {
        $phone = preg_replace('/\D+/', '', $phone) ?? $phone;
        $cacheKey = 'waha.chat_id.'.$phone;
        $cached = Cache::get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return ['chat_id' => $cached, 'retryable' => false, 'reason' => '', 'raw' => null];
        }

        try {
            $response = $this->client()->get('/api/contacts/check-exists', [
                'phone' => $phone,
                'session' => $this->session(),
            ]);

            if (! $response->successful()) {
                Log::warning('WAHA check-exists failed', [
                    'phone' => $phone,
                    'status' => $response->status(),
                ]);

                return [
                    'chat_id' => null,
                    'retryable' => true,
                    'reason' => 'WAHA belum dapat memvalidasi nomor; coba lagi nanti.',
                    'raw' => $response->json() ?: ['status' => $response->status()],
                ];
            }

            if (! (bool) ($response->json('numberExists') ?? false)) {
                return [
                    'chat_id' => null,
                    'retryable' => false,
                    'reason' => 'Nomor tidak terdaftar WhatsApp.',
                    'raw' => ['phone' => $phone, 'numberExists' => false],
                ];
            }

            $chatId = $this->normalizeChatId((string) ($response->json('chatId') ?? ($phone.'@c.us')));
            Cache::put($cacheKey, $chatId, now()->addDays(7));

            return ['chat_id' => $chatId, 'retryable' => false, 'reason' => '', 'raw' => null];
        } catch (Throwable $e) {
            Log::warning('WAHA check-exists exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            return [
                'chat_id' => null,
                'retryable' => true,
                'reason' => 'WAHA tidak dapat dihubungi saat memvalidasi nomor.',
                'raw' => ['exception' => $e::class],
            ];
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

        $recipient = $this->resolveRecipient($phone);
        if ($recipient['chat_id'] === null) {
            return $recipient['retryable']
                ? $this->deferredResult($recipient['reason'], $recipient['raw'])
                : $this->failResult($recipient['reason'], $recipient['raw']);
        }
        $chatId = $recipient['chat_id'];

        if (! $this->acquireRateSlot()) {
            return $this->deferredResult('Rate limit WAHA (~8 pesan/menit).');
        }

        if ($markSeen) {
            $this->sendSeen($chatId);
        }

        $this->withTyping($chatId, strlen($text));

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
        $previous = $this->sessionStatus();
        Cache::put(self::CACHE_SESSION_STATUS, $status, now()->addDays(7));
        Cache::put(self::CACHE_SESSION_STATUS.'.data', $data, now()->addDays(7));

        if (in_array($status, ['FAILED', 'SCAN_QR_CODE'], true)) {
            Log::critical('WAHA session needs attention', [
                'status' => $status,
                'session' => $this->session(),
                'data' => $data,
            ]);
            if ($previous !== $status) {
                $this->recordSessionEvent('whatsapp.session_attention_required', $status);
            }
        }

        if ($status === 'WORKING' && is_array($data) && $this->dataLooksLikeTimelock($data)) {
            $this->markTimelock(now()->addHour());
            Log::warning('WAHA reachout timelock detected via session.status', [
                'session' => $this->session(),
                'data' => $data,
            ]);
            $this->recordSessionEvent('whatsapp.timelock_detected', $status);
        } elseif ($status === 'WORKING') {
            Cache::forget(self::CACHE_TIMELOCK);
            if ($previous !== 'WORKING') {
                $this->recordSessionEvent('whatsapp.session_working', $status);
            }
        }
    }

    protected function recordSessionEvent(string $eventType, string $status): void
    {
        try {
            ActivityLogService::record(
                $eventType,
                'whatsapp_session',
                0,
                ['status' => $status, 'session' => $this->session()],
            );
        } catch (Throwable $e) {
            Log::warning('WAHA session activity log failed', [
                'event' => $eventType,
                'error' => $e->getMessage(),
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

    protected function withTyping(string $chatId, int $contentLength): void
    {
        $this->startTyping($chatId);

        try {
            $this->humanDelay(max(1, $contentLength));
        } finally {
            $this->stopTyping($chatId);
        }
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

            $retryable = $response->status() === 408
                || $response->status() === 429
                || $response->serverError();
            $result = [
                'successful' => $response->successful(),
                'provider_message_id' => $response->json('id')
                    ?? $response->json('message.id')
                    ?? $response->json('messageId'),
                'provider_session' => $this->session(),
                'status' => $response->successful() ? 'sent' : ($retryable ? 'deferred' : 'failed'),
                'error_reason' => $response->successful() ? null : $response->body(),
                'raw_payload' => $response->json() ?: ['body' => $response->body()],
                'chat_id' => $chatId,
            ];

            if ($swallow) {
                return $result;
            }

            return $result;
        } catch (Throwable $e) {
            $result = [
                'successful' => false,
                'provider_message_id' => null,
                'provider_session' => $this->session(),
                'status' => 'deferred',
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

    protected function client(): PendingRequest
    {
        return Http::withHeaders([
            'X-Api-Key' => (string) config('services.whatsapp.waha.api_key'),
        ])
            ->baseUrl(rtrim((string) config('services.whatsapp.waha.base_url'), '/'))
            ->timeout((int) config('services.whatsapp.waha.timeout', 10))
            ->retry(2, 500, function (Throwable $exception): bool {
                if ($exception instanceof ConnectionException) {
                    return true;
                }

                if (! $exception instanceof RequestException) {
                    return false;
                }

                $status = $exception->response->status();

                return $status === 408 || $status === 429 || $status >= 500;
            }, throw: false)
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
