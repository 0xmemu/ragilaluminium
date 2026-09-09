<?php

namespace App\Events;

use App\Models\WhatsAppMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class AdminWhatsAppReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $event_id;
    public string $occurred_at;

    public int $message_id;
    public string $phone_number;
    public ?string $customer_name;
    public ?string $order_number;
    public string $content_text;
    public string $href;

    public function __construct(WhatsAppMessage $message)
    {
        $this->event_id = Str::uuid()->toString();
        $this->occurred_at = now()->toIso8601String();

        $this->message_id = $message->id;
        $this->phone_number = (string) $message->phone_number;
        $this->customer_name = $message->order?->customer_name;
        $this->order_number = $message->order?->order_number;
        $this->content_text = Str::limit((string) $message->content_text, 140);
        $this->href = route('admin.whatsapp.messages.index', ['phone' => $message->phone_number]);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('admin.operations'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'whatsapp.received';
    }
}
