<?php

namespace App\Support;

use App\Events\AdminOrderCreated;
use App\Events\AdminOrderUpdated;
use App\Events\AdminWhatsAppReceived;
use App\Models\Order;
use App\Models\WhatsAppMessage;
use Illuminate\Support\Facades\Log;

/**
 * Dispatcher terpusat untuk event live admin (Pesanan dan WhatsApp).
 *
 * Dipanggil setelah persistensi transaksi commit.
 * Dilengkapi fail-safe: kegagalan broadcast tidak pernah membatalkan proses utama.
 */
class AdminLiveEvents
{
    /** Pesanan baru masuk yang memerlukan notifikasi live ke admin. */
    public static function orderCreated(Order $order): ?string
    {
        if (! $order->exists) {
            return null;
        }

        try {
            $event = new AdminOrderCreated($order);
            event($event);

            return $event->event_id;
        } catch (\Throwable $e) {
            Log::warning("AdminLiveEvents orderCreated broadcast failed: " . $e->getMessage());

            return null;
        }
    }

    /** Perubahan status pesanan yang memerlukan broadcast ke admin. */
    public static function orderUpdated(Order $order, array $changedFields = []): ?string
    {
        if (! $order->exists || $order->updated_at === null) {
            return null;
        }

        try {
            $event = new AdminOrderUpdated($order, $changedFields);
            event($event);

            return $event->event_id;
        } catch (\Throwable $e) {
            Log::warning("AdminLiveEvents orderUpdated broadcast failed: " . $e->getMessage());

            return null;
        }
    }

    /** Pesan WhatsApp masuk yang memerlukan notifikasi live ke admin. */
    public static function whatsAppReceived(WhatsAppMessage $message): ?string
    {
        if (! $message->exists) {
            return null;
        }

        try {
            $event = new AdminWhatsAppReceived($message);
            event($event);

            return $event->event_id;
        } catch (\Throwable $e) {
            Log::warning("AdminLiveEvents whatsAppReceived broadcast failed: " . $e->getMessage());

            return null;
        }
    }
}
