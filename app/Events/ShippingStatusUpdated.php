<?php

namespace App\Events;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ShippingStatusUpdated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Order $order,
        public ShippingRecord $record,
        public ?string $previousStatus,
        public string $newStatus,
    ) {
    }
}
