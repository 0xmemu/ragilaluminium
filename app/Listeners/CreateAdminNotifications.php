<?php

namespace App\Listeners;

use App\Events\OrderCancelled;
use App\Events\OrderCreated;
use App\Events\OrderReturnCreated;
use App\Events\ShippingStatusUpdated;
use App\Models\AdminNotification;
use App\Models\OrderReturnCase;

/**
 * Notifikasi admin (spec F): Pesanan Baru, Sampai, Dibatalkan.
 * 1 daftar; klik → detail order.
 */
class CreateAdminNotifications
{
    public function notifyOrderCreated(OrderCreated $event): void
    {
        $order = $event->order;

        AdminNotification::create([
            'type' => 'order_created',
            'title' => 'Pesanan Baru '.$order->order_number,
            'body' => $order->customer_name.' · '.$order->shipping_city
                .' · Rp '.number_format((float) $order->total_amount, 0, ',', '.'),
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
            'body' => $order->customer_name.' · '.$order->shipping_city,
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
                .($event->reason ? ' · '.$event->reason : ''),
            'order_id' => $order->id,
            'href' => route('admin.orders.show', $order),
        ]);
    }

    /**
     * Notifikasi retur dibuat (Sprint 2.1).
     * Idempoten per return_case_id: event yang diproses ulang tidak membuat duplikat.
     */
    public function notifyOrderReturnCreated(OrderReturnCreated $event): void
    {
        $order = $event->order;
        $case = $event->returnCase;

        $exists = AdminNotification::query()
            ->where('type', 'return_created')
            ->where('related_type', OrderReturnCase::class)
            ->where('related_id', $case->id)
            ->exists();

        if ($exists) {
            return;
        }

        AdminNotification::create([
            'type' => 'return_created',
            'related_type' => OrderReturnCase::class,
            'related_id' => $case->id,
            'order_id' => $order->id,
            'title' => 'Retur Baru '.$order->order_number,
            'body' => 'Alasan: '.$case->reason
                .' · Pihak: '.($case->fault_party === 'store' ? 'Toko' : ($case->fault_party === 'customer' ? 'Pelanggan' : 'Lainnya')),
            'href' => route('admin.orders.show', $order),
        ]);
    }
}

