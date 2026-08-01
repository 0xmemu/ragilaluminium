<?php

namespace App\Services;

use App\Events\OrderCreated;
use App\Events\PaymentConfirmed;
use App\Jobs\RetryDeferredWhatsAppMessage;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsApp\WhatsAppManager;
use App\Support\PhoneNumber;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    public function __construct(protected WhatsAppManager $manager) {}

    public function sendTemplateMessage(string $phone, string $internalKey, array $variables = [], ?int $orderId = null): ?WhatsAppMessage
    {
        $template = WhatsAppTemplate::active()->where('internal_key', $internalKey)->first();

        if (! $template) {
            Log::warning('WhatsApp template not found / inactive', ['key' => $internalKey]);

            return null;
        }

        $phone = PhoneNumber::normalize($phone) ?? $phone;
        $driverName = $this->manager->defaultDriver();

        $dispatch = fn () => $this->dispatchTemplateMessage(
            $driverName,
            $template,
            $phone,
            $internalKey,
            $variables,
            $orderId,
            true,
        );

        if ($orderId === null) {
            return $dispatch();
        }

        $lockKey = "whatsapp:send:{$driverName}:{$orderId}:{$internalKey}";

        return Cache::lock($lockKey, 60)->block(10, function () use (
            $orderId,
            $internalKey,
            $driverName,
            $dispatch,
        ) {
            if (! $this->alreadySent($orderId, $internalKey, $driverName)) {
                return $dispatch();
            }

            return WhatsAppMessage::query()
                ->where('order_id', $orderId)
                ->where('internal_template_key', $internalKey)
                ->where('provider', $driverName)
                ->whereIn('status', ['pending', 'sent', 'delivered', 'read', 'deferred', 'failed'])
                ->latest('id')
                ->first();
        });
    }

    public function sendTextMessage(string $phone, string $text, ?int $orderId = null): ?WhatsAppMessage
    {
        $phone = PhoneNumber::normalize($phone) ?? $phone;
        $driverName = $this->manager->defaultDriver();
        $driver = $this->manager->driver($driverName);

        $message = WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $orderId,
            'phone_number' => $phone,
            'provider' => $driverName,
            'internal_template_key' => 'free_form',
            'status' => 'pending',
            'content_text' => $text,
            'content_payload' => ['variables' => [$text]],
        ]);

        if (! $driver->configured()) {
            $message->update([
                'status' => 'failed',
                'error_reason' => "Driver {$driverName} belum dikonfigurasi.",
            ]);

            return $message;
        }

        $this->applyProviderResult($message, $driver->sendText($phone, $text));

        return $message;
    }

    /**
     * @return array{
     *   configured: bool,
     *   driver: string,
     *   default_provider: string,
     *   providers: array<string, mixed>,
     *   waha_session_status: ?string,
     *   waha_timelock: bool
     * }
     */
    public function connectionStatus(): array
    {
        $driver = $this->manager->defaultDriver();
        $meta = $this->manager->meta();
        $waha = $this->manager->waha();

        return [
            'configured' => $this->manager->driver($driver)->configured(),
            'driver' => $driver,
            'default_provider' => $driver,
            'providers' => [
                'meta' => [
                    'configured' => $meta->configured(),
                    'base_url' => config('services.whatsapp.meta.base_url'),
                    'token_set' => filled(config('services.whatsapp.meta.token')),
                    'number_id_set' => filled(config('services.whatsapp.meta.number_id')),
                    'verify_token_set' => filled(config('services.whatsapp.meta.verify_token')),
                ],
                'waha' => [
                    'configured' => $waha->configured(),
                    'base_url' => config('services.whatsapp.waha.base_url'),
                    'session' => config('services.whatsapp.waha.session'),
                    'api_key_set' => filled(config('services.whatsapp.waha.api_key')),
                    'hmac_secret_set' => filled(config('services.whatsapp.waha.hmac_secret')),
                    'notif_number' => config('services.whatsapp.waha.notif_number'),
                    'webhook_path' => '/api/webhooks/waha',
                ],
            ],
            'waha_session_status' => $waha->sessionStatus(),
            'waha_timelock' => $waha->timelockActive(),
        ];
    }

    public function handleMetaWebhook(array $payload): void
    {
        $entry = $payload['entry'][0]['changes'][0]['value'] ?? null;
        if (! $entry) {
            return;
        }

        $messages = $entry['messages'] ?? [];
        $statuses = $entry['statuses'] ?? [];

        $this->handleCanonicalWebhook(
            'meta',
            collect($messages)->map(fn (array $msg) => [
                'provider_message_id' => $msg['id'] ?? null,
                'phone' => PhoneNumber::normalize($msg['from'] ?? null) ?? ($msg['from'] ?? null),
                'text' => $msg['text']['body'] ?? null,
                'raw' => $msg,
                'provider_session' => null,
            ])->all(),
            collect($statuses)->map(fn (array $status) => [
                'provider_message_id' => $status['id'] ?? null,
                'status' => $status['status'] ?? null,
            ])->all(),
        );
    }

    /** @deprecated Use handleMetaWebhook */
    public function handleWebhook(array $payload): void
    {
        $this->handleMetaWebhook($payload);
    }

    public function handleWahaWebhook(array $payload): void
    {
        $event = (string) ($payload['event'] ?? '');
        $body = is_array($payload['payload'] ?? null) ? $payload['payload'] : [];
        $session = $payload['session'] ?? config('services.whatsapp.waha.session');

        if ($event === 'session.status') {
            $status = (string) ($body['status'] ?? $payload['status'] ?? 'UNKNOWN');
            $this->manager->waha()->rememberSessionStatus($status, $body);

            return;
        }

        if ($event === 'message' && ! ($body['fromMe'] ?? false)) {
            $chatId = $this->manager->waha()->normalizeChatId(
                (string) ($body['from'] ?? ($body['chatId'] ?? ''))
            );

            $this->handleCanonicalWebhook('waha', [[
                'provider_message_id' => $body['id'] ?? null,
                'phone' => $this->normalizeWahaPhone($chatId),
                'text' => $body['body'] ?? null,
                'raw' => $payload,
                'provider_session' => $session,
                'chat_id' => $chatId,
            ]], []);

            return;
        }

        if ($event === 'message.ack') {
            $this->handleCanonicalWebhook('waha', [], [[
                'provider_message_id' => $body['id'] ?? null,
                'status' => $this->mapWahaAckStatus($body['ack'] ?? null),
            ]]);
        }
    }

    protected function dispatchTemplateMessage(
        string $provider,
        WhatsAppTemplate $template,
        string $phone,
        string $internalKey,
        array $variables,
        ?int $orderId,
        bool $degradeWhenUnconfigured,
    ): ?WhatsAppMessage {
        $driver = $this->manager->driver($provider);
        $rendered = $this->renderTemplateBody($template, $variables);

        $message = WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $orderId,
            'phone_number' => $phone,
            'provider' => $provider,
            'internal_template_key' => $internalKey,
            'status' => 'pending',
            'content_text' => $provider === 'waha' ? $rendered : null,
            'content_payload' => ['variables' => $variables],
        ]);

        if (! $driver->configured()) {
            if ($degradeWhenUnconfigured) {
                $message->update([
                    'status' => 'failed',
                    'error_reason' => "Driver {$provider} belum dikonfigurasi.",
                ]);

                return $message;
            }

            $message->update(['status' => 'failed', 'error_reason' => "Driver {$provider} belum dikonfigurasi."]);

            return $message;
        }

        $result = $driver->sendTemplate(
            $phone,
            (string) $template->provider_template_name,
            (string) $template->language_code,
            $variables,
            $rendered,
        );

        $this->applyProviderResult($message, $result);

        return $message;
    }

    /**
     * @param  array{
     *   successful?: bool,
     *   provider_message_id?: ?string,
     *   provider_session?: ?string,
     *   status?: string,
     *   error_reason?: ?string,
     *   raw_payload?: mixed,
     *   chat_id?: ?string
     * }  $result
     */
    protected function applyProviderResult(WhatsAppMessage $message, array $result): void
    {
        $payload = $message->content_payload ?? [];
        if (! empty($result['chat_id'])) {
            $payload['chat_id'] = $result['chat_id'];
        }

        $status = $result['status'] ?? (($result['successful'] ?? false) ? 'sent' : 'failed');

        $message->update([
            'provider_message_id' => $result['provider_message_id'] ?? null,
            'provider_session' => $result['provider_session'] ?? null,
            'status' => $status,
            'sent_at' => ($result['successful'] ?? false) ? now() : null,
            'error_reason' => $result['error_reason'] ?? null,
            'raw_payload' => $result['raw_payload'] ?? null,
            'content_payload' => $payload,
        ]);

        if ($status === 'deferred') {
            RetryDeferredWhatsAppMessage::dispatch($message->id)->delay(now()->addHour());
        }
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $statuses
     */
    protected function handleCanonicalWebhook(string $provider, array $messages, array $statuses): void
    {
        foreach ($messages as $msg) {
            $providerId = $msg['provider_message_id'] ?? null;
            $attributes = [
                'direction' => 'inbound',
                'phone_number' => $msg['phone'] ?? '-',
                'provider' => $provider,
                'provider_session' => $msg['provider_session'] ?? null,
                'content_text' => $msg['text'] ?? null,
                'status' => 'received',
                'received_at' => now(),
                'raw_payload' => $msg['raw'] ?? null,
                'content_payload' => isset($msg['chat_id']) ? ['chat_id' => $msg['chat_id']] : null,
            ];

            if ($providerId) {
                WhatsAppMessage::firstOrCreate(
                    ['provider' => $provider, 'provider_message_id' => $providerId],
                    $attributes,
                );
            } else {
                WhatsAppMessage::create($attributes);
            }
        }

        foreach ($statuses as $status) {
            $providerId = $status['provider_message_id'] ?? null;
            if (! $providerId) {
                continue;
            }

            $message = WhatsAppMessage::query()
                ->where('provider', $provider)
                ->where('provider_message_id', $providerId)
                ->first();

            if ($message) {
                $message->update(['status' => $status['status'] ?? $message->status]);
            }
        }
    }

    protected function alreadySent(int $orderId, string $internalKey, string $provider): bool
    {
        return WhatsAppMessage::query()
            ->where('order_id', $orderId)
            ->where('internal_template_key', $internalKey)
            ->where('provider', $provider)
            ->whereIn('status', ['pending', 'sent', 'delivered', 'read', 'deferred', 'failed'])
            ->exists();
    }

    protected function renderTemplateBody(WhatsAppTemplate $template, array $variables): string
    {
        $body = (string) ($template->body_preview ?: '');

        foreach (array_values($variables) as $index => $value) {
            $body = str_replace('{{'.($index + 1).'}}', (string) $value, $body);
        }

        return trim($body) !== '' ? trim($body) : implode("\n", $variables);
    }

    protected function normalizeWahaPhone(?string $chatId): ?string
    {
        if (! $chatId) {
            return null;
        }

        $chatId = preg_replace('/@.+$/', '', $chatId) ?? $chatId;

        return PhoneNumber::normalize($chatId) ?? $chatId;
    }

    protected function mapWahaAckStatus(mixed $ack): string
    {
        return match ((int) $ack) {
            3 => 'read',
            2 => 'delivered',
            1 => 'sent',
            default => 'pending',
        };
    }

    public function handleOrderCreated(OrderCreated $event): void
    {
        $order = $event->order->loadMissing('items');
        $items = $order->items->map(fn ($item) => $item->name.' × '.$item->quantity)->implode(', ');
        $total = number_format((float) $order->total_amount, 0, ',', '.');
        $variables = [$order->order_number, $items !== '' ? $items : '-', $total];

        $key = ($order->cod_flag || $order->payment_method === 'cod')
            ? 'order_created'
            : 'payment_instructions';

        $this->sendTemplateMessage(
            $order->customer_phone,
            $key,
            $variables,
            $order->id
        );
    }

    public function handlePaymentConfirmed(PaymentConfirmed $event): void
    {
        $order = $event->order;
        $this->sendTemplateMessage(
            $order->customer_phone,
            'payment_confirmed',
            [$order->order_number],
            $order->id
        );
    }
}
