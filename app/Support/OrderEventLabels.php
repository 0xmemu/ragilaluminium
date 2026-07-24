<?php

namespace App\Support;

/**
 * Indonesian labels for admin order timeline / activity snippets.
 */
class OrderEventLabels
{
    /** @var array<string, string> */
    private const ORDER_STATUSES = [
        'pending_payment' => 'Menunggu pembayaran',
        'pending' => 'Menunggu',
        'pending_pickup' => 'Menunggu penjemputan',
        'processing' => 'Diproses',
        'shipped' => 'Dikirim',
        'delivered' => 'Diterima',
        'completed' => 'Selesai',
        'issue' => 'Kendala',
        'return_in_process' => 'Retur diproses',
        'cancelled' => 'Dibatalkan',
    ];

    public static function orderStatus(?string $code): string
    {
        if ($code === null || $code === '') {
            return '—';
        }

        return self::ORDER_STATUSES[$code] ?? str_replace('_', ' ', $code);
    }

    /**
     * Short label for order show timeline (not the long ActivityLog sentence).
     *
     * @param  array<string, mixed>  $payload
     */
    public static function eventType(string $eventType, array $payload = []): string
    {
        return match ($eventType) {
            'order.created' => 'Pesanan dibuat',
            'order_status_changed' => sprintf(
                'Status: %s → %s',
                self::orderStatus(isset($payload['from']) ? (string) $payload['from'] : null),
                self::orderStatus(isset($payload['order_status']) ? (string) $payload['order_status'] : null),
            ),
            'order.cancelled' => 'Pesanan dibatalkan',
            default => str_replace(['_', '.'], ' ', $eventType),
        };
    }

    public static function whatsappTemplate(?string $internalKey): string
    {
        if (! filled($internalKey)) {
            return 'Pesan WhatsApp';
        }

        foreach (WhatsAppAutomationCatalog::all() as $trigger) {
            if ($trigger['internal_key'] === $internalKey) {
                return $trigger['label'];
            }
        }

        $map = [
            'order_created' => 'Notifikasi pesanan dibuat',
            'order_paid' => 'Notifikasi pembayaran',
            'order_shipped' => 'Notifikasi pengiriman',
            'inbound' => 'Pesan masuk',
            'outbound' => 'Pesan keluar',
        ];

        return $map[$internalKey] ?? str_replace('_', ' ', $internalKey);
    }
}
