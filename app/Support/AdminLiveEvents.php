<?php

namespace App\Support;

use App\Events\AdminOrderUpdated;
use App\Models\Order;

/**
 * Dispatcher terpusat utk event live admin (pilot: Pesanan).
 *
 * Dipanggil SETELAH transaction commit pada mutation order yang relevan.
 * Menghindari duplikasi: satu mutation path → satu event.
 *
 * @return string|null event_id atau null bila tidak dipancarkan
 */
class AdminLiveEvents
{
    /** Perubahan order yang memerlukan broadcast ke admin. */
    public static function orderUpdated(Order $order, array $changedFields = []): ?string
    {
        // Jangan broadcast utk mutation yang belum dipersist (mis. model baru dgn
        // updated_at null di dalam transaction belum commit).
        if (! $order->exists || $order->updated_at === null) {
            return null;
        }

        $event = new AdminOrderUpdated($order, $changedFields);
        event($event);

        return $event->event_id;
    }
}
