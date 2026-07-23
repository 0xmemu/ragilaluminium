<?php

namespace App\Services;

use App\Events\OrderCreated;
use App\Events\PaymentConfirmed;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Support\PhoneNumber;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
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
                        'parameters' => collect($variables)->map(fn ($v) => ['type' => 'text', 'text' => (string) $v])->values()->all(),
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
            $text = $msg['text']['body'] ?? null;
            $providerId = $msg['id'] ?? null;

            // Idempoten: webhook Meta bisa dikirim ulang, hindari duplikasi.
            WhatsAppMessage::firstOrCreate(
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

    public function handleOrderCreated(OrderCreated $event): void
    {
        $order = $event->order->loadMissing('items');
        $items = $order->items->map(fn ($item) => $item->name.' × '.$item->quantity)->implode(', ');
        $total = number_format((float) $order->total_amount, 0, ',', '.');
        $variables = [$order->order_number, $items !== '' ? $items : '-', $total];

        // Figma / Stage 8: COD → order_created; transfer → payment_instructions.
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

    protected function endpoint(): string
    {
        return rtrim(config('services.whatsapp.base_url'), '/')
            .'/'.config('services.whatsapp.number_id').'/messages';
    }
}
