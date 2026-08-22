<?php

namespace App\Support;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;

/**
 * Payload lacak pesanan (header resi, milestone, timeline) dari order + event_logs.
 */
class OrderTrackingPresenter
{
    /**
     * @return list<array{message: string, at: string|null, source: string}>
     */
    public static function timeline(Order $order, int $limit = 20): array
    {
        $logs = EventLog::query()
            ->where('entity_type', 'order')
            ->where('entity_id', $order->id)
            ->whereIn('event_type', [
                'order.created',
                'order_status_changed',
                'order.cancelled',
                'payment.confirmed',
                'shipping.created',
                'shipping.status_updated',
            ])
            ->latest('created_at')
            ->limit($limit)
            ->get();

        $tracking = ShippingTrackingEvent::query()
            ->where('order_id', $order->id)
            ->latest('occurred_at')
            ->latest('id')
            ->limit($limit)
            ->get();

        $entries = $logs->map(function (EventLog $log): array {
            $payload = is_array($log->payload) ? $log->payload : [];

            return [
                'message' => self::timelineMessage((string) $log->event_type, $payload),
                'at' => optional($log->created_at)?->toIso8601String(),
                'source' => (string) $log->event_type,
            ];
        })->merge($tracking->map(function (ShippingTrackingEvent $event): array {
            $raw = $event->description ?: $event->provider_status;
            $local = self::trackingScanLabel((string) $event->provider_status, $event->location);

            return [
                // Label lokal Indonesia per scanType; fallback ke teks asli kurir.
                'message' => $local ?? self::timelineMessage('shipping.status_updated', [
                    'raw' => $raw,
                    'to' => $event->normalized_status,
                ]),
                // Teks asli dari J&T tetap disertakan sebagai detail.
                'detail' => $local !== null && $raw !== '' && $raw !== (string) $event->provider_status
                    ? $raw
                    : null,
                'location' => $event->location,
                'at' => optional($event->occurred_at)?->toIso8601String(),
                'source' => 'tracking:'.$event->source,
            ];
        }))->sortByDesc(fn (array $entry): string => (string) ($entry['at'] ?? ''))->take($limit)->values()->all();

        if ($entries !== []) {
            return $entries;
        }

        return self::fallbackTimeline($order);
    }

    /**
     * @return array<string, mixed>
     */
    public static function forOrder(Order $order, ?ShippingRecord $shipping = null, bool $withTimeline = true): array
    {
        if ($shipping === null && $order->relationLoaded('shippingRecords')) {
            $shipping = $order->shippingRecords->first(
                fn ($record) => $record->status !== 'cancelled'
            ) ?? $order->shippingRecords->first();
        }

        $timeline = $withTimeline ? self::timeline($order) : [];
        $latest = $timeline[0] ?? null;

        if ($latest === null && ! $withTimeline) {
            $snippet = self::timeline($order, 1);
            $latest = $snippet[0] ?? null;
        }

        $paid = $order->payment_status === 'paid';

        return [
            'shipping_status' => (string) $order->shipping_status,
            'carrier_name' => $shipping?->carrier_name,
            'waybill_number' => $shipping?->waybill_number,
            'record_status' => $shipping?->status,
            'status_raw' => $shipping?->status_raw,
            'last_status_at' => optional($shipping?->last_status_at)?->toIso8601String(),
            'tracking_url' => $shipping?->tracking_url,
            'order_status' => (string) $order->order_status,
            'payment_status' => (string) $order->payment_status,
            'payment_method' => $order->payment_method,
            'total_amount' => (float) $order->total_amount,
            'paid' => $paid,
            'latest_message' => $latest['message'] ?? self::defaultLatestMessage($order, $shipping),
            'latest_at' => $latest['at'] ?? optional($shipping?->last_status_at ?? $order->updated_at)?->toIso8601String(),
            'timeline' => $timeline,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function timelineMessage(string $eventType, array $payload = []): string
    {
        $isCod = filled($payload['payment_method'] ?? null)
            ? ($payload['payment_method'] === 'cod' || ($payload['cod_flag'] ?? false))
            : false;

        return match ($eventType) {
            'order.created' => $isCod
                ? 'Pesanan diterima. Produk masuk antrean produksi (bayar di tempat).'
                : 'Pesanan Anda telah dibuat dan menunggu konfirmasi.',
            'payment.confirmed' => 'Pembayaran dikonfirmasi. Pesanan siap diproses.',
            'shipping.created' => filled($payload['waybill'] ?? null)
                ? 'Resi pengiriman diterbitkan: '.$payload['waybill']
                : 'Pengiriman dicatat. Resi akan menyusul.',
            'shipping.status_updated' => self::shippingUpdateMessage($payload),
            'order.cancelled' => 'Pesanan dibatalkan.',
            'order_status_changed' => self::orderStatusChangeMessage($payload),
            default => OrderEventLabels::eventType($eventType, $payload),
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function shippingUpdateMessage(array $payload): string
    {
        $raw = trim((string) ($payload['raw'] ?? ''));
        if ($raw !== '' && ! is_numeric($raw) && strlen($raw) > 2) {
            return $raw;
        }

        $to = isset($payload['to']) ? (string) $payload['to'] : null;

        return match ($to) {
            // Pipeline tracking J&T - docs open.jtcargo.co.id
            'tracking_pending' => 'Paket menunggu penjemputan kurir.',
            'picked_up' => 'Paket dijemput kurir.',
            'in_transit' => 'Paket sedang dalam perjalanan.',
            'delivered' => 'Pesanan telah diterima.',
            'returned' => 'Paket dikembalikan ke pengirim.',
            'cancelled' => 'Pengiriman dibatalkan.',
            'exception' => 'Ada kendala pengiriman.',
            'unknown' => 'Status pengiriman diperbarui.',
            // Legacy
            'pending_pickup' => 'Paket menunggu penjemputan kurir.',
            'in_process' => 'Paket sedang disiapkan di gudang.',
            default => 'Status pengiriman diperbarui.',
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    /**
     * Label lokal Indonesia per scanType J&T (docs open.jtcargo.co.id).
     * Return null bila scanType tidak dikenal - UI memakai teks asli kurir.
     */
    private static function trackingScanLabel(string $scanType, ?string $location): ?string
    {
        $loc = $location !== null && trim($location) !== '' ? ' '.trim($location) : '';

        return match ($scanType) {
            '1' => 'Paket dijemput kurir'.$loc,
            '3' => 'Paket dikirim dari pusat sortir'.$loc,
            '4' => 'Paket tiba di pusat sortir'.$loc,
            '5' => 'Paket keluar dari pusat sortir'.$loc,
            '10' => 'Paket telah diterima'.$loc,
            '11' => 'Paket bermasalah, sedang ditangani'.$loc,
            '12' => 'Paket dikembalikan ke pengirim'.$loc,
            '13' => 'Penjemputan paket gagal'.$loc,
            default => null,
        };
    }

    private static function orderStatusChangeMessage(array $payload): string
    {
        $to = isset($payload['order_status']) ? (string) $payload['order_status'] : null;

        return match ($to) {
            'pending' => 'Menunggu konfirmasi pembayaran.',
            'processing' => 'Pesanan sedang diproses oleh admin gudang.',
            'shipped' => 'Pesanan sedang dikirim oleh ekspedisi.',
            'delivered' => 'Paket berhasil diterima.',
            'completed' => 'Terima kasih, pesanan Anda telah selesai.',
            'cancelled' => 'Pesanan dibatalkan.',
            'issue' => 'Ada kendala pada pesanan. Tim akan menghubungi Anda.',
            'return_in_process' => 'Retur pesanan sedang diproses.',
            'return_completed' => 'Retur pesanan selesai dan telah dicatat oleh admin.',
            default => OrderEventLabels::eventType('order_status_changed', $payload),
        };
    }

    /**
     * @return list<array{message: string, at: string|null, source: string}>
     */
    private static function fallbackTimeline(Order $order): array
    {
        $shipping = $order->relationLoaded('shippingRecords')
            ? ($order->shippingRecords->first(fn ($r) => $r->status !== 'cancelled')
                ?? $order->shippingRecords->first())
            : null;

        $entries = [];

        if ($shipping?->status_raw || $shipping?->last_status_at) {
            $entries[] = [
                'message' => filled($shipping->status_raw) && ! is_numeric((string) $shipping->status_raw)
                    ? (string) $shipping->status_raw
                    : self::shippingUpdateMessage(['to' => $shipping->status]),
                'at' => optional($shipping->last_status_at ?? $shipping->updated_at)?->toIso8601String(),
                'source' => 'shipping_record',
            ];
        }

        $entries[] = [
            'message' => self::orderStatusChangeMessage(['order_status' => $order->order_status]),
            'at' => optional($order->updated_at)?->toIso8601String(),
            'source' => 'order_status',
        ];

        $isCod = $order->cod_flag || $order->payment_method === 'cod';
        $entries[] = [
            'message' => $isCod
                ? 'Pesanan diterima. Produk masuk antrean produksi (bayar di tempat).'
                : 'Pesanan Anda telah dibuat dan menunggu konfirmasi.',
            'at' => optional($order->created_at)?->toIso8601String(),
            'source' => 'order.created',
        ];

        return $entries;
    }

    private static function defaultLatestMessage(Order $order, ?ShippingRecord $shipping): string
    {
        if (filled($shipping?->status_raw) && ! is_numeric((string) $shipping->status_raw)) {
            return (string) $shipping->status_raw;
        }

        return self::orderStatusChangeMessage(['order_status' => $order->order_status]);
    }
}
