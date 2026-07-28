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

        $message = WhatsAppMessage::create([
            'direction' => 'outbound',
            'order_id' => $orderId,
            'phone_number' => $phone,
            'internal_template_key' => $internalKey,
            'status' => 'pending',
            'content_payload' => ['variables' => $variables],
        ]);

        if (! config('services.whatsapp.token')) {
            // No provider configured (dev/test): mark as sent without calling the API.
            $message->update(['status' => 'sent', 'sent_at' => now()]);

            return $message;
        }

        // Meta (#132018): parameter teks tidak boleh newline/tab / spasi beruntun > 4.
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
                'components' => [
                    [
                        'type' => 'body',
                        'parameters' => $parameters,
                    ],
                ],
            ],
        ];

        try {
            $response = Http::withToken(config('services.whatsapp.token'))
                ->timeout((int) config('services.whatsapp.timeout', 15))
                ->retry(2, 500, throw: false)
                ->post($this->endpoint(), $payload);

            if ($response->successful()) {
                $providerId = $response->json('messages.0.id');
                $message->update([
                    'provider_message_id' => $providerId,
                    'status' => 'sent',
                    'sent_at' => now(),
                    'raw_payload' => $response->json(),
                ]);
            } else {
                $message->update([
                    'status' => 'failed',
                    'error_reason' => $response->body(),
                    'raw_payload' => $response->json(),
                ]);
            }
        } catch (\Throwable $e) {
            $message->update(['status' => 'failed', 'error_reason' => $e->getMessage()]);
        }

        return $message;
    }

    public function sendTextMessage(string $phone, string $text, ?int $orderId = null): ?WhatsAppMessage
    {
        return $this->sendTemplateMessage($phone, 'free_form', [$text], $orderId);
    }

    public function handleWebhook(array $payload): void
    {
        $entry = $payload['entry'][0]['changes'][0]['value'] ?? null;
        if (! $entry) {
            return;
        }

        $messages = $entry['messages'] ?? [];
        $statuses = $entry['statuses'] ?? [];

        foreach ($messages as $msg) {
            $phone = PhoneNumber::normalize($msg['from'] ?? null) ?? ($msg['from'] ?? null);
            $text = $this->extractInboundText($msg);
            $providerId = $msg['id'] ?? null;

            // Idempoten: webhook Meta bisa dikirim ulang, hindari duplikasi.
            $message = WhatsAppMessage::firstOrCreate(
                ['provider_message_id' => $providerId],
                [
                    'direction' => 'inbound',
                    'phone_number' => $phone,
                    'content_text' => $text,
                    'status' => 'received',
                    'received_at' => now(),
                    'raw_payload' => $msg,
                ]
            );

            // Hanya proses aksi saat baris baru (bukan replay webhook).
            if ($message->wasRecentlyCreated) {
                $this->handleInboundCustomerAction($message, $msg, $phone);
            }
        }

        foreach ($statuses as $status) {
            $providerId = $status['id'] ?? null;
            $state = $status['status'] ?? null;
            $message = WhatsAppMessage::where('provider_message_id', $providerId)->first();
            if ($message) {
                $message->update(['status' => $state ?? $message->status]);
            }
        }
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
        $order = $event->order->loadMissing('items');

        // Stage 8: COD → order_created; transfer → payment_instructions.
        $key = ($order->cod_flag || $order->payment_method === 'cod')
            ? 'order_created'
            : 'payment_instructions';

        $variables = $key === 'order_created'
            ? $this->variablesForOrderCreatedCod($order)
            : $this->variablesForPaymentInstructions($order);

        $this->sendTemplateMessage(
            $order->customer_phone,
            $key,
            $variables,
            $order->id
        );
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

    protected function endpoint(): string
    {
        return rtrim(config('services.whatsapp.base_url'), '/')
            .'/'.config('services.whatsapp.number_id').'/messages';
    }
}
