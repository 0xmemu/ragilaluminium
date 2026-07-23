<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        \App\Events\OrderCreated::class => [
            \App\Listeners\SendOrderCreatedWhatsApp::class,
        ],
        \App\Events\PaymentConfirmed::class => [
            \App\Listeners\SendPaymentConfirmedWhatsApp::class,
        ],
        \App\Events\ShippingStatusUpdated::class => [
            \App\Listeners\SendShippingStatusWhatsApp::class,
        ],
    ];
}
