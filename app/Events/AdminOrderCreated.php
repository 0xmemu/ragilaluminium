<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class AdminOrderCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $event_id;
    public string $occurred_at;

    public int $order_id;
    public string $order_number;
    public string $customer_name;
    public string $customer_phone;
    public float $total_amount;
    public string $total_amount_formatted;
    public string $shipping_city;
    public string $href;

    public function __construct(Order $order)
    {
        $this->event_id = Str::uuid()->toString();
        $this->occurred_at = now()->toIso8601String();

        $this->order_id = $order->id;
        $this->order_number = (string) $order->order_number;
        $this->customer_name = (string) ($order->customer_name ?? 'Pelanggan');
        $this->customer_phone = (string) ($order->customer_phone ?? '');
        $this->total_amount = (float) $order->total_amount;
        $this->total_amount_formatted = 'Rp ' . number_format((float) $order->total_amount, 0, ',', '.');
        $this->shipping_city = (string) ($order->shipping_city ?? '');
        $this->href = route('admin.orders.show', $order);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('admin.operations'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'order.created';
    }
}
