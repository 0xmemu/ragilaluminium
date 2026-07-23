<?php

namespace App\Listeners;

use App\Events\PaymentConfirmed;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendPaymentConfirmedWhatsApp implements ShouldQueue
{
    public bool $afterCommit = true;

    public function __construct(protected WhatsAppService $whatsapp)
    {
    }

    public function handle(PaymentConfirmed $event): void
    {
        $this->whatsapp->handlePaymentConfirmed($event);
    }
}
