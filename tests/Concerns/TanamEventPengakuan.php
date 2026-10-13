<?php

namespace Tests\Concerns;

use App\Models\EventLog;
use App\Models\Order;
use App\Services\StorePerformanceService;

/**
 * Fixture Performa Toko mengikuti aturan pengakuan P0.2: pesanan uji
 * berstatus penjualan dianggap TERCATAT mencapai Diproses pada waktu pesanan
 * dibuat, kecuali test menanam jadwal eventnya sendiri.
 *
 * Payload 'from' sengaja 'processing' supaya event ini TIDAK dihitung sebagai
 * transisi konfirmasi oleh perhitungan waktu konfirmasi dan waktu proses;
 * satu-satunya konsumennya adalah pengakuan omzet.
 */
trait TanamEventPengakuan
{
    protected function tanamEventPengakuan(Order $order, ?string $waktu = null): Order
    {
        if (! in_array((string) $order->order_status, StorePerformanceService::REVENUE_STATUSES, true)) {
            return $order;
        }

        // Waktu event: created_at pesanan, kecuali fixture memundurkan
        // updated_at lebih tua (pola test umur status di dashboard), supaya
        // simulasi umur status tetap terbaca oleh logika yang membaca event
        // status terbaru.
        $masuk = $order->created_at ?? now();
        if ($order->updated_at !== null && $order->updated_at->lt($masuk)) {
            $masuk = $order->updated_at;
        }

        EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['from' => 'processing', 'order_status' => 'processing', 'source' => 'test'],
            'created_by_user_id' => null,
            'created_at' => $waktu ?? $masuk,
        ]);

        return $order;
    }
}
