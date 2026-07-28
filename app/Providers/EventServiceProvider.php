<?php

namespace App\Providers;

use App\Events\OrderCreated;
use App\Events\OrderProcessingStarted;
use App\Events\PaymentConfirmed;
use App\Events\ShippingStatusUpdated;
use App\Listeners\SendOrderCreatedWhatsApp;
use App\Listeners\SendOrderProcessingWhatsApp;
use App\Listeners\SendPaymentConfirmedWhatsApp;
use App\Listeners\SendShippingStatusWhatsApp;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        OrderCreated::class => [
            SendOrderCreatedWhatsApp::class,
        ],
        PaymentConfirmed::class => [
            SendPaymentConfirmedWhatsApp::class,
        ],
        OrderProcessingStarted::class => [
            SendOrderProcessingWhatsApp::class,
        ],
        ShippingStatusUpdated::class => [
            SendShippingStatusWhatsApp::class,
        ],
    ];
}
