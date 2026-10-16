<?php

namespace App\Events;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * Perubahan status pengiriman (resi) yang dipancarkan ke channel admin.
 *
 * Kenapa terpisah dari ShippingStatusUpdated: event itu membawa model Order dan
 * ShippingRecord secara utuh. Kalau disiarkan langsung, seluruh atribut pesanan
 * termasuk nama, telepon, dan alamat pelanggan ikut terkirim ke peramban.
 * Event ini hanya membawa field yang aman, mengikuti pola AdminOrderUpdated.
 *
 * Latar: perubahan resi dari J&T sebelumnya tidak pernah sampai ke panel lewat
 * WebSocket, sehingga panel harus menanyakannya berkala. Dengan event ini,
 * perubahan resi datang sendiri.
 *
 * Channel: private-admin.operations (hanya admin terautentikasi).
 */
class AdminShippingStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $event_id;
    public string $occurred_at;

    public int $order_id;
    public string $order_number;
    public string $previous_status;
    public string $new_status;
    public string $shipping_status;
    public string $href;

    public function __construct(Order $order, ShippingRecord $record, ?string $previousStatus, string $newStatus)
    {
        $this->event_id = Str::uuid()->toString();
        $this->occurred_at = now()->toIso8601String();

        $this->order_id = (int) $order->id;
        $this->order_number = (string) $order->order_number;
        $this->previous_status = (string) ($previousStatus ?? '');
        $this->new_status = $newStatus;
        $this->shipping_status = (string) $order->shipping_status;
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
        return 'shipping.updated';
    }

    public function broadcastQueue(): string
    {
        return 'broadcast';
    }
}
