<?php

namespace App\Support;

/**
 * Indonesian labels for admin order timeline / activity snippets.
 */
class OrderEventLabels
{
    /** @var array<string, string> */
    private const ORDER_STATUSES = [
        'awaiting_confirmation' => 'Menunggu konfirmasi',
        'pending' => 'Menunggu',
        'pending_pickup' => 'Menunggu penjemputan',
        'processing' => 'Diproses',
        'shipped' => 'Dikirim',
        'delivered' => 'Diterima',
        'completed' => 'Selesai',
        'issue' => 'Kendala',
        'return_in_process' => 'Retur diproses',
        'return_completed' => 'Retur selesai',
        'cancelled' => 'Dibatalkan',
    ];

    /**
     * Metode pembayaran yang dipilih pembeli. Penanda cod_flag ikut dibaca
     * supaya pesanan lama yang metodenya belum tercatat tetap terbaca COD.
     */
    public static function paymentMethod(?string $method, bool $codFlag = false): string
    {
        if ($codFlag || $method === 'cod') {
            return 'COD';
        }

        return match ($method) {
            'transfer' => 'Transfer Bank',
            null, '' => '-',
            default => 'Lainnya',
        };
    }

    /** Status uang masuk menurut catatan sistem. */
    public static function paymentStatus(?string $status): string
    {
        return match ($status) {
            'paid' => 'Lunas',
            'refunded' => 'Refund',
            'pending' => 'Belum dibayar',
            null, '' => '-',
            default => 'Status lain',
        };
    }

    public static function orderStatus(?string $code): string
    {
        if ($code === null || $code === '') {
            return '-';
        }

        return self::ORDER_STATUSES[$code] ?? 'Status lain';
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
            'order.edited' => 'Pesanan diedit admin',
            'order_returned' => 'Pesanan dikembalikan',
            'payment.confirmed' => 'Pembayaran dikonfirmasi',
            'shipping.created' => 'Pengiriman dibuat',
            'shipping.status_updated' => 'Status pengiriman diperbarui',
            'system/cod_settlement' => 'Pelunasan COD otomatis saat paket sampai',
            'system/cod_completion' => 'Pelunasan COD otomatis saat pesanan selesai',
            'payment.reconciled' => 'Pembayaran dicocokkan ulang',
            'whatsapp.logged_out' => 'Sesi WhatsApp terputus',
            // Cadangan TIDAK lagi mengubah penanda sistem menjadi kalimat Inggris
            // (dulu payment.reconciled tampil payment reconciled). Jenis event baru
            // wajib didaftarkan di daftar di atas (kontrak owner 2026-10-16).
            default => 'Perubahan tercatat',
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

        return $map[$internalKey] ?? 'Pesan WhatsApp';
    }
}
