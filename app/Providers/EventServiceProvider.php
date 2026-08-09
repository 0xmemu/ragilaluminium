<?php

namespace App\Providers;

use App\Events\OrderCreated;
use App\Events\OrderCancelled;
use App\Events\OrderProcessingStarted;
use App\Events\PaymentConfirmed;
use App\Events\ShippingStatusUpdated;
use App\Listeners\CreateAdminNotifications;
use App\Listeners\ReportQueueBusy;
use App\Listeners\ReportQueueJobFailure;
use App\Listeners\SendOrderCreatedWhatsApp;
use App\Listeners\SendOrderProcessingWhatsApp;
use App\Listeners\SendPaymentConfirmedWhatsApp;
use App\Listeners\SendShippingStatusWhatsApp;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\QueueBusy;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        JobFailed::class => [
            ReportQueueJobFailure::class,
        ],
        QueueBusy::class => [
            ReportQueueBusy::class,
        ],
        PaymentConfirmed::class => [
            SendPaymentConfirmedWhatsApp::class,
        ],
        OrderProcessingStarted::class => [
            SendOrderProcessingWhatsApp::class,
        ],
        ShippingStatusUpdated::class => [
            SendShippingStatusWhatsApp::class,
            CreateAdminNotifications::class . '@notifyOrderDelivered',
        ],
        OrderCreated::class => [
            SendOrderCreatedWhatsApp::class,
            CreateAdminNotifications::class . '@notifyOrderCreated',
        ],
        OrderCancelled::class => [
            CreateAdminNotifications::class . '@notifyOrderCancelled',
        ],
    ];
}
