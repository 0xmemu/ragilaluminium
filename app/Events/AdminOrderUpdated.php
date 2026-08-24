<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * Perubahan status pesanan yang dipancarkan ke channel admin.
 * Hanya setelah transaction commit. Payload minimum tanpa PII sensitif.
 *
 * Channel: private-admin.operations
 * Authorization: user authenticated + admin (EnsureUserIsAdmin).
 */
class AdminOrderUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $event_id;
    public string $occurred_at;

    public int $order_id;
    public string $order_number;
    public string $order_status;
    public string $payment_status;
    public string $shipping_status;
    public string $return_status;
    public string $updated_at;
    /** @var list<string> */
    public array $changed_fields;

    public function __construct(Order $order, array $changedFields = [])
    {
        $this->event_id = Str::uuid()->toString();
        $this->occurred_at = now()->toIso8601String();

        $this->order_id = $order->id;
        $this->order_number = $order->order_number;
        $this->order_status = $order->order_status;
        $this->payment_status = $order->payment_status;
        $this->shipping_status = $order->shipping_status;
        $this->return_status = $order->order_status === 'return_in_process' || $order->order_status === 'return_completed'
            ? $order->order_status
            : '';
        $this->updated_at = optional($order->updated_at)->toIso8601String() ?? now()->toIso8601String();
        $this->changed_fields = $changedFields;
    }

    /**
     * Channel private admin. Hanya admin terautentikasi yang dapat subscribe.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('admin.operations'),
        ];
    }

    /**
     * Nama event untuk frontend listener.
     */
    public function broadcastAs(): string
    {
        return 'order.updated';
    }
}