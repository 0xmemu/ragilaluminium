<?php

namespace App\Support;

use App\Models\AdminNotification;
use App\Models\Order;

class ShippingQuoteManualReviewNotifier
{
    public static function notify(Order $order, array $quote): void
    {
        $existing = AdminNotification::query()
            ->where('type', 'shipping_quote_manual_review')
            ->where('related_type', Order::class)
            ->where('related_id', $order->id)
            ->whereNull('read_at')
            ->latest('id')
            ->first();

        $body = 'Ongkir provisional Rp '.number_format((float) ($quote['rough_estimate'] ?? 9999), 0, ',', '.')
            .' perlu diverifikasi manual sebelum diproses.';

        if ($existing) {
            $existing->update([
                'title' => 'Review ongkir diperlukan',
                'body' => $body,
                'href' => route('admin.orders.show', $order),
            ]);

            return;
        }

        AdminNotification::create([
            'type' => 'shipping_quote_manual_review',
            'related_type' => Order::class,
            'related_id' => $order->id,
            'order_id' => $order->id,
            'title' => 'Review ongkir diperlukan',
            'body' => $body,
            'href' => route('admin.orders.show', $order),
        ]);
    }
}
