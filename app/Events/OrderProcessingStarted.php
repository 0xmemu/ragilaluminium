<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * COD (atau fulfillment tanpa pelunasan di muka) mulai diproses.
 * Memicu template WhatsApp `payment_confirmed` ("pesanan diproses").
 */
class OrderProcessingStarted
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Order $order,
        public string $source = 'admin',
    ) {}
}
