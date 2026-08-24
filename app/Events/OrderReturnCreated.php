<?php

namespace App\Events;

use App\Models\Order;
use App\Models\OrderReturnCase;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderReturnCreated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Order $order,
        public OrderReturnCase $returnCase,
    ) {
    }
}