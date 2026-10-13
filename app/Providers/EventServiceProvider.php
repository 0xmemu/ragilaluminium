<?php

namespace App\Providers;

use App\Events\OrderCreated;
use App\Events\OrderReturnCreated;
use App\Events\OrderCancelled;
use App\Events\OrderProcessingStarted;
use App\Events\PaymentConfirmed;
use App\Events\ProductEngagementRecorded;
use App\Events\ShippingStatusUpdated;
use App\Listeners\CreateAdminNotifications;
use App\Listeners\EvaluateProductPopularityThresholds;
use App\Listeners\ReportQueueBusy;
use App\Listeners\ReportQueueJobFailure;
use App\Listeners\SendOrderCreatedWhatsApp;
use App\Listeners\SendOrderProcessingWhatsApp;
use App\Listeners\SendPaymentConfirmedWhatsApp;
use App\Listeners\SendShippingStatusWhatsApp;
use App\Listeners\TrackProductEngagement;
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
            EvaluateProductPopularityThresholds::class,
        ],
        ShippingStatusUpdated::class => [
            SendShippingStatusWhatsApp::class,
            CreateAdminNotifications::class . '@notifyOrderDelivered',
            CreateAdminNotifications::class . '@notifyOrderReturned',
            EvaluateProductPopularityThresholds::class,
        ],
        OrderCreated::class => [
            SendOrderCreatedWhatsApp::class,
            CreateAdminNotifications::class . '@notifyOrderCreated',
        ],
        OrderCancelled::class => [
            CreateAdminNotifications::class . '@notifyOrderCancelled',
        ],
        OrderReturnCreated::class => [
            CreateAdminNotifications::class . '@notifyOrderReturnCreated',
        ],
        ProductEngagementRecorded::class => [
            TrackProductEngagement::class,
        ],
    ];
}
