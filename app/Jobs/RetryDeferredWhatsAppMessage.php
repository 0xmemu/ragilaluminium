<?php

namespace App\Jobs;

use App\Models\WhatsAppMessage;
use App\Services\WhatsApp\WhatsAppManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Retry deferred WAHA outbound (rate limit / reachout timelock). Best-effort.
 */
class RetryDeferredWhatsAppMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /** @var list<int> */
    public array $backoff = [60, 300, 900, 3600, 7200];

    public function __construct(public int $messageId) {}

    public function handle(WhatsAppManager $manager): void
    {
        $message = WhatsAppMessage::query()->find($this->messageId);
        if (! $message || $message->direction !== 'outbound') {
            return;
        }

        if ($message->status !== 'deferred') {
            return;
        }

        if ($message->provider !== 'waha') {
            return;
        }

        $text = (string) ($message->content_text ?? '');
        if ($text === '') {
            $variables = $message->content_payload['variables'] ?? [];
            $text = is_array($variables) ? implode("\n", $variables) : '';
        }

        if ($text === '') {
            $message->update(['status' => 'failed', 'error_reason' => 'Deferred retry tanpa konten.']);

            return;
        }

        $driver = $manager->waha();
        if (! $driver->configured()) {
            Log::warning('RetryDeferredWhatsAppMessage: WAHA not configured', ['id' => $message->id]);

            return;
        }

        $result = $driver->sendHumanizedText($message->phone_number, $text);

        $payload = $message->content_payload ?? [];
        if (! empty($result['chat_id'])) {
            $payload['chat_id'] = $result['chat_id'];
        }

        $message->update([
            'provider_message_id' => $result['provider_message_id'] ?? null,
            'provider_session' => $result['provider_session'] ?? null,
            'status' => $result['status'] ?? 'failed',
            'sent_at' => ($result['successful'] ?? false) ? now() : null,
            'error_reason' => $result['error_reason'] ?? null,
            'raw_payload' => $result['raw_payload'] ?? null,
            'content_payload' => $payload,
        ]);

        if (($result['status'] ?? '') === 'deferred') {
            $this->release($this->backoff[min($this->attempts() - 1, count($this->backoff) - 1)]);
        }
    }
}
