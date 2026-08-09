<?php

namespace App\Services;

use App\Events\OrderCreated;
use App\Events\PaymentConfirmed;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ShippingRecord;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Support\BankTransferInstructions;
use App\Support\PhoneNumber;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    public function __construct(protected OrderService $orders) {}

    public function sendTemplateMessage(string $phone, string $internalKey, array $variables = [], ?int $orderId = null): ?WhatsAppMessage
    {
        $template = WhatsAppTemplate::active()->where('internal_key', $internalKey)->first();

        if (! $template) {
            Log::warning('WhatsApp template not found / inactive', ['key' => $internalKey]);

            return null;
        }

        $phone = PhoneNumber::normalize($phone) ?? $phone;

        $primaryProvider = $this->defaultProvider();
        $message = $this->dispatchTemplateMessage(
            $primaryProvider,
            $template,
            $phone,
            $internalKey,
            $variables,
            $orderId,
            true,
        );

        $compareProvider = $this->compareProvider();
        if (
            $compareProvider
            && $compareProvider !== $primaryProvider
            && $this->providerConfigured($compareProvider)
            && $this->shouldSendCompareCopy($phone)
        ) {
            $this->dispatchTemplateMessage(
                $compareProvider,
                $template,
                $phone,
                $internalKey,
                $variables,
                $orderId,
                false,
            );
        }

        return $message;
    }

    public function sendTextMessage(string $phone, string $text, ?int $orderId = null): ?WhatsAppMessage
    {
        $phone = PhoneNumber::normalize($phone) ?? $phone;
        $provider = $this->defaultProvider();

        $message = WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $orderId,
            'phone_number' => $phone,
            'provider' => $provider,
            'internal_template_key' => 'free_form',
            'status' => 'pending',
            'content_text' => $text,
            'content_payload' => ['variables' => [$text]],
        ]);

        if (! $this->providerConfigured($provider)) {
            $message->update(['status' => 'sent', 'sent_at' => now()]);

            return $message;
        }

        $result = $provider === 'baileys'
            ? $this->sendViaBaileys($phone, $text)
            : $this->sendViaMetaText($phone, $text);

        $this->applyProviderResult($message, $result);

        return $message;
    }

    /**
     * @return array{
     *   configured: bool,
     *   default_provider: string,
     *   compare_provider: string|null,
     *   compare_allowlist: list<string>,
     *   providers: array<string, array{
     *     configured: bool,
     *     base_url: string|null,
     *     token_set: bool,
     *     number_id_set?: bool,
     *     verify_token_set?: bool,
     *     session?: string|null,
     *     api_key_set?: bool,
     *     webhook_secret_set?: bool
     *   }>
     * }
     */
    public function connectionStatus(): array
    {
        $defaultProvider = $this->defaultProvider();

        return [
            'configured' => $this->providerConfigured($defaultProvider),
            'default_provider' => $defaultProvider,
            'compare_provider' => $this->compareProvider(),
            'compare_allowlist' => $this->compareAllowlist(),
            'providers' => [
                'meta' => [
                    'configured' => $this->providerConfigured('meta'),
                    'base_url' => config('services.whatsapp.meta.base_url'),
                    'token_set' => filled(config('services.whatsapp.meta.token')),
                    'number_id_set' => filled(config('services.whatsapp.meta.number_id')),
                    'verify_token_set' => filled(config('services.whatsapp.meta.verify_token')),
                ],
                'baileys' => [
                    'configured' => $this->providerConfigured('baileys'),
                    'base_url' => config('services.whatsapp.baileys.base_url'),
                    'token_set' => filled(config('services.whatsapp.baileys.api_key')),
                    'session' => config('services.whatsapp.baileys.session'),
                    'api_key_set' => filled(config('services.whatsapp.baileys.api_key')),
                    'webhook_secret_set' => filled(config('services.whatsapp.baileys.webhook_secret')),
                ],
            ],
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
                'text' => $this->extractInboundText($msg),
                'raw' => $msg,
                'provider_session' => null,
            ])->all(),
            collect($statuses)->map(fn (array $status) => [
                'provider_message_id' => $status['id'] ?? null,
                'status' => $status['status'] ?? null,
            ])->all(),
        );
    }

    public function handleBaileysWebhook(array $payload): void
    {
        $event = (string) ($payload['event'] ?? '');
        $body = $payload['payload'] ?? [];
        $session = $payload['session'] ?? config('services.whatsapp.baileys.session');

        if ($event === 'message' && ! ($body['fromMe'] ?? false)) {
            $this->handleCanonicalWebhook('baileys', [[
                'provider_message_id' => $body['id'] ?? null,
                'phone' => $this->normalizeBaileysPhone($body['from'] ?? ($body['chatId'] ?? null)),
                'text' => $body['body'] ?? null,
                'raw' => $payload,
                'provider_session' => $session,
            ]], []);

            return;
        }

        if ($event === 'message.ack') {
            $this->handleCanonicalWebhook('baileys', [], [[
                'provider_message_id' => $body['id'] ?? null,
                'status' => $this->mapBaileysAckStatus($body['ack'] ?? null),
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
        $message = WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $orderId,
            'phone_number' => $phone,
            'provider' => $provider,
            'internal_template_key' => $internalKey,
            'status' => 'pending',
            'content_text' => $provider === 'baileys' ? $this->renderTemplateBody($template, $variables) : null,
            'content_payload' => ['variables' => $variables],
        ]);

        if (! $this->providerConfigured($provider)) {
            if ($degradeWhenUnconfigured) {
                $message->update(['status' => 'sent', 'sent_at' => now()]);

                return $message;
            }

            $message->update(['status' => 'failed', 'error_reason' => "Provider {$provider} belum dikonfigurasi."]);

            return $message;
        }

        $result = $provider === 'baileys'
            ? $this->sendViaBaileys($phone, $this->renderTemplateBody($template, $variables))
            : $this->sendViaMetaTemplate($template, $phone, $variables);

        $this->applyProviderResult($message, $result);

        return $message;
    }

    protected function applyProviderResult(WhatsAppMessage $message, array $result): void
    {
        $message->update([
            'provider_message_id' => $result['provider_message_id'] ?? null,
            'provider_session' => $result['provider_session'] ?? null,
            'status' => $result['status'] ?? ($result['successful'] ? 'sent' : 'failed'),
            'sent_at' => ($result['successful'] ?? false) ? now() : null,
            'error_reason' => $result['error_reason'] ?? null,
            'raw_payload' => $result['raw_payload'] ?? null,
        ]);
    }

    protected function sendViaMetaTemplate(WhatsAppTemplate $template, string $phone, array $variables): array
    {
        $parameters = collect($variables)
            ->map(fn ($v) => ['type' => 'text', 'text' => $this->sanitizeTemplateParam((string) $v)])
            ->values()
            ->all();

        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $phone,
            'type' => 'template',
            'template' => [
                'name' => $template->provider_template_name,
                'language' => ['code' => $template->language_code],
                'components' => [[
                    'type' => 'body',
                    'parameters' => $parameters,
                ]],
            ],
        ];

        return $this->sendMetaPayload($payload);
    }

    protected function sendViaMetaText(string $phone, string $text): array
    {
        return $this->sendMetaPayload([
            'messaging_product' => 'whatsapp',
            'to' => $phone,
            'type' => 'text',
            'text' => ['body' => $this->sanitizeTemplateParam($text)],
        ]);
    }

    protected function sendMetaPayload(array $payload): array
    {
        try {
            $response = Http::withToken(config('services.whatsapp.meta.token'))
                ->timeout((int) config('services.whatsapp.meta.timeout', 15))
                ->retry(2, 500, throw: false)
                ->post($this->metaEndpoint(), $payload);

            return [
                'successful' => $response->successful(),
                'provider_message_id' => $response->json('messages.0.id'),
                'provider_session' => null,
                'status' => $response->successful() ? 'sent' : 'failed',
                'error_reason' => $response->successful() ? null : $response->body(),
                'raw_payload' => $response->json() ?: ['body' => $response->body()],
            ];
        } catch (\Throwable $e) {
            return [
                'successful' => false,
                'provider_message_id' => null,
                'provider_session' => null,
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'raw_payload' => null,
            ];
        }
    }

    protected function sendViaBaileys(string $phone, string $text): array
    {
        $payload = [
            'session' => config('services.whatsapp.baileys.session', 'default'),
            'chatId' => $this->toBaileysChatId($phone),
            'text' => $text,
        ];

        try {
            $response = Http::withHeaders([
                'X-Api-Key' => (string) config('services.whatsapp.baileys.api_key'),
            ])
                ->timeout((int) config('services.whatsapp.baileys.timeout', 15))
                ->retry(2, 500, throw: false)
                ->post(rtrim((string) config('services.whatsapp.baileys.base_url'), '/').'/api/sendText', $payload);

            return [
                'successful' => $response->successful(),
                'provider_message_id' => $response->json('id')
                    ?? $response->json('message.id')
                    ?? $response->json('messageId'),
                'provider_session' => (string) ($payload['session'] ?? 'default'),
                'status' => $response->successful() ? 'sent' : 'failed',
                'error_reason' => $response->successful() ? null : $response->body(),
                'raw_payload' => $response->json() ?: ['body' => $response->body()],
            ];
        } catch (\Throwable $e) {
            return [
                'successful' => false,
                'provider_message_id' => null,
                'provider_session' => (string) ($payload['session'] ?? 'default'),
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'raw_payload' => null,
            ];
        }
    }

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
            ];

            $message = $providerId
                ? WhatsAppMessage::firstOrCreate(
                    ['provider' => $provider, 'provider_message_id' => $providerId],
                    $attributes,
                )
                : WhatsAppMessage::create($attributes);

            if ($message->wasRecentlyCreated) {
                $this->handleInboundCustomerAction($message, (array) ($msg['raw'] ?? []), $msg['phone'] ?? null);
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

    protected function defaultProvider(): string
    {
        return $this->normalizeProvider((string) config('services.whatsapp.default_provider', 'meta'));
    }

    protected function compareProvider(): ?string
    {
        $provider = trim((string) config('services.whatsapp.compare_provider', ''));

        return $provider === '' ? null : $this->normalizeProvider($provider);
    }

    protected function normalizeProvider(string $provider): string
    {
        return strtolower($provider) === 'baileys' ? 'baileys' : 'meta';
    }

    protected function providerConfigured(string $provider): bool
    {
        return match ($provider) {
            'baileys' => filled(config('services.whatsapp.baileys.base_url')) && filled(config('services.whatsapp.baileys.api_key')),
            default => filled(config('services.whatsapp.meta.token')) && filled(config('services.whatsapp.meta.number_id')),
        };
    }

    /**
     * @return list<string>
     */
    protected function compareAllowlist(): array
    {
        return collect(config('services.whatsapp.compare_allowlist', []))
            ->map(fn ($phone) => PhoneNumber::normalize((string) $phone))
            ->filter()
            ->values()
            ->all();
    }

    protected function shouldSendCompareCopy(string $phone): bool
    {
        return in_array($phone, $this->compareAllowlist(), true);
    }

    protected function renderTemplateBody(WhatsAppTemplate $template, array $variables): string
    {
        $body = (string) ($template->body_preview ?: '');

        foreach (array_values($variables) as $index => $value) {
            $body = str_replace('{{'.($index + 1).'}}', (string) $value, $body);
        }

        return trim($body) !== '' ? trim($body) : implode("\n", $variables);
    }

    protected function toBaileysChatId(string $phone): string
    {
        return $phone.'@c.us';
    }

    protected function normalizeBaileysPhone(?string $chatId): ?string
    {
        if (! $chatId) {
            return null;
        }

        $chatId = preg_replace('/@.+$/', '', $chatId) ?? $chatId;

        return PhoneNumber::normalize($chatId) ?? $chatId;
    }

    protected function mapBaileysAckStatus(mixed $ack): string
    {
        return match ((int) $ack) {
            3 => 'read',
            2 => 'delivered',
            1 => 'sent',
            default => 'pending',
        };
    }

    /**
     * Tombol / balasan konfirmasi COD → pending_payment → processing + WA "pesanan diproses".
     *
     * @param  array<string, mixed>  $msg
     */
    protected function handleInboundCustomerAction(WhatsAppMessage $message, array $msg, ?string $phone): void
    {
        if (! $this->isOrderConfirmation($msg, $message->content_text)) {
            return;
        }

        $order = $this->resolveOrderForInbound($phone, $msg);
        if (! $order) {
            Log::info('WhatsApp confirm: no pending order for phone', ['phone' => $phone]);

            return;
        }

        $message->update(['order_id' => $order->id]);

        $started = $this->orders->beginProcessing($order, null, 'whatsapp_customer');
        if (! $started) {
            Log::info('WhatsApp confirm: order not started', [
                'order_id' => $order->id,
                'status' => $order->fresh()?->order_status,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $msg
     */
    protected function extractInboundText(array $msg): ?string
    {
        $parts = array_filter([
            $msg['text']['body'] ?? null,
            $msg['button']['text'] ?? null,
            $msg['button']['payload'] ?? null,
            $msg['interactive']['button_reply']['title'] ?? null,
            $msg['interactive']['button_reply']['id'] ?? null,
            $msg['interactive']['list_reply']['title'] ?? null,
            $msg['interactive']['list_reply']['id'] ?? null,
        ], fn ($v) => filled($v));

        if ($parts === []) {
            return null;
        }

        return implode(' | ', array_map('strval', $parts));
    }

    /**
     * @param  array<string, mixed>  $msg
     */
    protected function isOrderConfirmation(array $msg, ?string $combinedText): bool
    {
        $candidates = array_filter([
            $msg['button']['payload'] ?? null,
            $msg['button']['text'] ?? null,
            $msg['interactive']['button_reply']['id'] ?? null,
            $msg['interactive']['button_reply']['title'] ?? null,
            $msg['interactive']['list_reply']['id'] ?? null,
            $msg['interactive']['list_reply']['title'] ?? null,
            $msg['text']['body'] ?? null,
            $combinedText,
        ], fn ($v) => filled($v));

        foreach ($candidates as $raw) {
            if ($this->matchesConfirmationPhrase((string) $raw)) {
                return true;
            }
        }

        return false;
    }

    protected function matchesConfirmationPhrase(string $raw): bool
    {
        $n = mb_strtolower(trim($raw));
        $n = preg_replace('/\s+/u', ' ', $n) ?? $n;

        if ($n === '') {
            return false;
        }

        $exact = [
            'oke', 'ok', 'ya', 'yes', 'y', 'benar', 'setuju', 'sesuai',
            'konfirmasi', 'confirm', 'confirmed',
        ];
        if (in_array($n, $exact, true)) {
            return true;
        }

        // Payload / id tombol Meta (bebas, sering snake_case).
        if (preg_match('/(confirm|konfirmasi|order_ok|proses_pesan|proses_pesanan|accept_order)/i', $n)) {
            return true;
        }

        // Judul tombol: "Oke, Proses Pesanan", "Ya, sesuai", dll.
        if (preg_match('/\b(oke|ok|ya|yes)\b/u', $n) && preg_match('/(proses|pesan|order|sesuai|benar|konfirm)/u', $n)) {
            return true;
        }

        if (preg_match('/proses\s*pesanan/u', $n)) {
            return true;
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $msg
     */
    protected function resolveOrderForInbound(?string $phone, array $msg): ?Order
    {
        $haystack = implode(' ', array_filter([
            $msg['button']['payload'] ?? null,
            $msg['interactive']['button_reply']['id'] ?? null,
            $msg['interactive']['list_reply']['id'] ?? null,
            $msg['text']['body'] ?? null,
        ]));

        if (preg_match('/RA-\d{6}-[A-Z0-9]+/i', $haystack, $match)) {
            $order = Order::query()
                ->where('order_number', strtoupper($match[0]))
                ->where('order_status', 'pending_payment')
                ->first();
            if ($order) {
                return $order;
            }
        }

        if (! $phone) {
            return null;
        }

        $recentOutbound = WhatsAppMessage::query()
            ->where('direction', 'outbound')
            ->where('phone_number', $phone)
            ->whereNotNull('order_id')
            ->whereIn('internal_template_key', ['order_created', 'payment_instructions'])
            ->latest('id')
            ->first();

        if ($recentOutbound) {
            $order = Order::query()
                ->where('id', $recentOutbound->order_id)
                ->where('order_status', 'pending_payment')
                ->first();
            if ($order) {
                return $order;
            }
        }

        return Order::query()
            ->where('order_status', 'pending_payment')
            ->where(function ($q) use ($phone) {
                $q->where('customer_phone', $phone);
                if (str_starts_with($phone, '62')) {
                    $q->orWhere('customer_phone', '0'.substr($phone, 2));
                }
            })
            ->latest('id')
            ->first();
    }

    public function handleOrderCreated(OrderCreated $event): void
    {
        $this->sendOrderConfirmation($event->order);
    }

    /**
     * Konfirmasi pesanan (order_created / payment_instructions) - dipakai saat
     * checkout dan dikirim ULANG setelah admin mengedit isi pesanan (keputusan #7).
     */
    public function sendOrderConfirmation(Order $order): ?WhatsAppMessage
    {
        $order->loadMissing('items');

        // Stage 8: COD → order_created; transfer → payment_instructions.
        $key = ($order->cod_flag || $order->payment_method === 'cod')
            ? 'order_created'
            : 'payment_instructions';

        $variables = $key === 'order_created'
            ? $this->variablesForOrderCreatedCod($order)
            : $this->variablesForPaymentInstructions($order);

        return $this->sendTemplateMessage(
            $order->customer_phone,
            $key,
            $variables,
            $order->id
        );
    }

    /** WA ulang konfirmasi setelah pesanan diedit admin. Aman bila gagal. */
    public function notifyOrderEdited(Order $order): ?WhatsAppMessage
    {
        try {
            return $this->sendOrderConfirmation($order);
        } catch (\Throwable $e) {
            Log::warning('Gagal kirim ulang WA konfirmasi setelah edit pesanan', [
                'order' => $order->order_number,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function handlePaymentConfirmed(PaymentConfirmed $event): void
    {
        $this->notifyOrderProcessing($event->order);
    }

    /**
     * Template `payment_confirmed` (= WA "pesanan diproses"). Idempotent per order.
     */
    public function notifyOrderProcessing(Order $order): ?WhatsAppMessage
    {
        $already = WhatsAppMessage::query()
            ->where('order_id', $order->id)
            ->where('direction', 'outbound')
            ->where('internal_template_key', 'payment_confirmed')
            ->whereIn('status', ['pending', 'sent', 'delivered', 'read'])
            ->exists();

        if ($already) {
            return null;
        }

        return $this->sendTemplateMessage(
            $order->customer_phone,
            'payment_confirmed',
            $this->variablesForPaymentConfirmed($order),
            $order->id
        );
    }

    public function handleShippingStatus(Order $order, ShippingRecord $record, string $templateKey): void
    {
        $variables = match ($templateKey) {
            'order_shipped' => $this->variablesForOrderShipped($order, $record),
            'order_delivered' => $this->variablesForOrderDelivered($order),
            'order_returned' => $this->variablesForOrderReturned($order, $record),
            default => [$order->order_number, $record->waybill_number ?: '-'],
        };

        $this->sendTemplateMessage(
            $order->customer_phone,
            $templateKey,
            $variables,
            $order->id,
        );
    }

    /**
     * @return list<string>
     */
    public function variablesForOrderCreatedCod(Order $order): array
    {
        $name = $this->customerName($order);

        // Meta melarang indeks yang sama dua kali di body — {{1}} sapaan, {{3}} blok DATA PENERIMA.
        return [
            $name,
            $order->order_number,
            $name,
            $this->formatAddress($order),
            $this->formatAddressDetail($order),
            $this->formatItems($order),
            $this->formatEta($order),
            $this->formatTotal($order),
        ];
    }

    /**
     * @return list<string>
     */
    public function variablesForPaymentInstructions(Order $order): array
    {
        $name = $this->customerName($order);
        $bank = BankTransferInstructions::forStorefront();

        return [
            $name,
            $order->order_number,
            $name,
            $this->formatAddress($order),
            $this->formatAddressDetail($order),
            $this->formatItems($order),
            $this->formatEta($order),
            $this->formatTotal($order),
            $bank['bank_name'] ?? '-',
            $bank['account_number'] ?? '-',
            $bank['account_name'] ?? '-',
        ];
    }

    /**
     * @return list<string>
     */
    public function variablesForPaymentConfirmed(Order $order): array
    {
        return [
            $this->customerName($order),
            $order->order_number,
            $this->formatEta($order),
        ];
    }

    /**
     * @return list<string>
     */
    public function variablesForOrderShipped(Order $order, ShippingRecord $record): array
    {
        $carrier = trim((string) ($record->carrier_name ?: 'J&T Cargo'));
        $waybill = trim((string) ($record->waybill_number ?: '-'));
        $link = trim((string) ($record->tracking_url ?: '')) ?: route('order.status');

        return [
            $this->customerName($order),
            $order->order_number,
            $carrier !== '' ? $carrier : 'J&T Cargo',
            $waybill !== '' ? $waybill : '-',
            $link,
            $this->formatEta($order),
        ];
    }

    /**
     * @return list<string>
     */
    public function variablesForOrderDelivered(Order $order): array
    {
        return [
            $this->customerName($order),
            $order->order_number,
        ];
    }

    /**
     * @return list<string>
     */
    public function variablesForOrderReturned(Order $order, ShippingRecord $record): array
    {
        $waybill = trim((string) ($record->waybill_number ?: '-'));

        return [
            $this->customerName($order),
            $order->order_number,
            $waybill !== '' ? $waybill : '-',
        ];
    }

    protected function customerName(Order $order): string
    {
        $name = trim((string) $order->customer_name);

        return $name !== '' ? $name : 'Kak';
    }

    protected function formatAddress(Order $order): string
    {
        $parts = array_filter([
            trim((string) $order->shipping_address_line1),
            trim((string) ($order->shipping_village ?? '')),
            trim((string) ($order->shipping_district ?? '')),
            trim((string) ($order->shipping_city ?? '')),
            trim((string) ($order->shipping_province ?? '')),
            trim((string) ($order->shipping_postal_code ?? '')),
        ], fn ($part) => $part !== '');

        return $parts !== [] ? implode(', ', $parts) : '-';
    }

    protected function formatAddressDetail(Order $order): string
    {
        $parts = array_filter([
            trim((string) ($order->shipping_address_line2 ?? '')),
            trim((string) ($order->notes ?? '')),
        ], fn ($part) => $part !== '');

        return $parts !== [] ? implode(' · ', $parts) : '-';
    }

    protected function formatItems(Order $order): string
    {
        $order->loadMissing('items');

        $lines = $order->items->map(function (OrderItem $item) {
            $qty = max(1, (int) $item->quantity);
            $name = trim((string) $item->name) ?: 'Produk';
            $header = "• {$qty} Unit {$name}";

            $attrs = array_filter([
                trim((string) ($item->variation_1_option ?? '')),
                trim((string) ($item->variation_2_option ?? '')),
            ], fn ($part) => $part !== '');

            if ($attrs !== []) {
                return $header.' ('.implode(' • ', $attrs).')';
            }

            return $header;
        })->filter()->values();

        // Satu baris per item dipisah " | " — Meta menolak newline di parameter template.
        return $lines->isNotEmpty() ? $lines->implode(' | ') : '-';
    }

    /**
     * Meta Cloud API menolak parameter body yang berisi newline/tab atau >4 spasi beruntun.
     */
    protected function sanitizeTemplateParam(string $value): string
    {
        $value = str_replace(["\r\n", "\r", "\n", "\t"], ' ', $value);
        $value = preg_replace('/ {5,}/', '    ', $value) ?? $value;
        $value = trim($value);

        return $value !== '' ? $value : '-';
    }

    protected function formatEta(Order $order): string
    {
        // Belum ada kolom ETA di schema order — placeholder ramah sampai SLA J&T tersimpan.
        return 'menyusul';
    }

    protected function formatTotal(Order $order): string
    {
        return number_format((float) $order->total_amount, 0, ',', '.');
    }

    protected function metaEndpoint(): string
    {
        return rtrim((string) config('services.whatsapp.meta.base_url'), '/')
            .'/'.config('services.whatsapp.meta.number_id').'/messages';
    }
}
