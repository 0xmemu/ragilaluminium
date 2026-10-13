<?php

namespace App\Listeners;

use App\Events\ShippingStatusUpdated;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendShippingStatusWhatsApp implements ShouldQueue
{
    public bool $afterCommit = true;

    public function __construct(protected WhatsAppService $whatsapp) {}

    public function handle(ShippingStatusUpdated $event): void
    {
        $order = $event->order;

        // Hanya kirim notifikasi untuk milestone yang berarti bagi pelanggan.
        $key = match ($event->newStatus) {
            'in_transit' => 'order_shipped',
            'delivered' => 'order_delivered',
            'returned' => 'order_returned',
            default => null,
        };

        if (! $key) {
            return;
        }

        $this->whatsapp->handleShippingStatus($order, $event->record, $key);
    }
}
