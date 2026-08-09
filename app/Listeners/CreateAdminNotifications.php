<?php

namespace App\Listeners;

use App\Events\OrderCancelled;
use App\Events\OrderCreated;
use App\Events\ShippingStatusUpdated;
use App\Models\AdminNotification;

/**
 * Notifikasi admin (spec ??F): Pesanan Baru, Sampai, Dibatalkan.
 * 1 daftar; klik ??? detail order.
 */
class CreateAdminNotifications
{
    public function notifyOrderCreated(OrderCreated $event): void
    {
        $order = $event->order;

        AdminNotification::create([
            'type' => 'order_created',
            'title' => 'Pesanan Baru '.$order->order_number,
            'body' => $order->customer_name.' ?? '.$order->shipping_city
                .' ?? Rp '.number_format((float) $order->total_amount, 0, ',', '.'),
            'order_id' => $order->id,
            'href' => route('admin.orders.show', $order),
        ]);
    }

    public function notifyOrderDelivered(ShippingStatusUpdated $event): void
    {
        if ($event->newStatus !== 'delivered') {
            return;
        }

        $order = $event->order;

        AdminNotification::create([
            'type' => 'order_delivered',
            'title' => 'Pesanan Sampai '.$order->order_number,
            'body' => $order->customer_name.' ?? '.$order->shipping_city,
            'order_id' => $order->id,
            'href' => route('admin.orders.show', $order),
        ]);
    }

    public function notifyOrderCancelled(OrderCancelled $event): void
    {
        $order = $event->order;

        AdminNotification::create([
            'type' => 'order_cancelled',
            'title' => 'Pesanan Dibatalkan '.$order->order_number,
            'body' => $order->customer_name
                .($event->reason ? ' ?? '.$event->reason : ''),
            'order_id' => $order->id,
            'href' => route('admin.orders.show', $order),
        ]);
    }
}

