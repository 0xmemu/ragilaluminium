<?php

namespace App\Listeners;

use App\Events\OrderProcessingStarted;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendOrderProcessingWhatsApp implements ShouldQueue
{
    public bool $afterCommit = true;

    public function __construct(protected WhatsAppService $whatsapp) {}

    public function handle(OrderProcessingStarted $event): void
    {
        $this->whatsapp->notifyOrderProcessing($event->order);
    }
}
