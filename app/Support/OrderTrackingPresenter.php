<?php

namespace App\Support;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\ShippingRecord;

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

        $entries = $logs->map(function (EventLog $log) {
            $payload = is_array($log->payload) ? $log->payload : [];

            return [
                'message' => self::timelineMessage((string) $log->event_type, $payload),
                'at' => optional($log->created_at)?->toIso8601String(),
                'source' => (string) $log->event_type,
            ];
        })->values()->all();

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

        $paid = $order->payment_status === 'paid'
            || (
                ($order->cod_flag || $order->payment_method === 'cod')
                && in_array($order->order_status, ['delivered', 'completed'], true)
            );

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
        return match ($eventType) {
            'order.created' => 'Pesanan Anda telah dibuat dan menunggu konfirmasi.',
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
            'pending_pickup' => 'Paket menunggu penjemputan kurir.',
            'in_process' => 'Paket sedang disiapkan di gudang.',
            'in_transit' => 'Paket dalam perjalanan menuju alamat Anda.',
            'delivered' => 'Paket berhasil diterima.',
            'returned' => 'Paket dalam proses retur.',
            'cancelled' => 'Pengiriman dibatalkan.',
            default => 'Status pengiriman diperbarui.',
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function orderStatusChangeMessage(array $payload): string
    {
        $to = isset($payload['order_status']) ? (string) $payload['order_status'] : null;

        return match ($to) {
            'pending_payment' => 'Menunggu konfirmasi pembayaran.',
            'processing' => 'Pesanan sedang diproses oleh toko.',
            'shipped' => 'Pesanan sedang dikirim oleh ekspedisi.',
            'delivered' => 'Paket berhasil diterima.',
            'completed' => 'Terima kasih, pesanan Anda telah selesai.',
            'cancelled' => 'Pesanan dibatalkan.',
            'issue' => 'Ada kendala pada pesanan. Tim akan menghubungi Anda.',
            'return_in_process' => 'Retur pesanan sedang diproses.',
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

        $entries[] = [
            'message' => 'Pesanan Anda telah dibuat dan menunggu konfirmasi.',
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
