<?php

namespace App\Listeners;

use App\Events\OrderCreated;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendOrderCreatedWhatsApp implements ShouldQueue
{
    public bool $afterCommit = true;

    public function __construct(protected WhatsAppService $whatsapp)
    {
    }

    public function handle(OrderCreated $event): void
    {
        $this->whatsapp->handleOrderCreated($event);
    }
}
