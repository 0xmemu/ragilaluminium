<?php

namespace App\Support;

use App\Models\Order;

/**
 * OrderStatusView — normalizer pembacaan status order/payment/COD yang AMAN
 * terhadap skema payment saat ini (hanya payment_status pending|paid).
 *
 * TUJUAN/UTILITAS:
 *  - Satu sumber pembagian bucket pembayaran yang tidak overclaim.
 *  - Abstraction sehingga migrasi skema payment di masa depan (proof_received,
 *    pending_verification, pending_collection, refunded) tidak perlu mengubah
 *    seluruh komponen UI; hanya method normalizer ini yang disesuaikan.
 *
 * BATASAN (penting, jangan diabaikan):
 *  - payment_status saat ini HANYA `pending` | `paid`.
 *  - Oleh karena itu TIDAK AMAN membedakan "belum bayar" vs "bukti diterima"
 *    (keduanya pending). Jangan klaim status proof_received/pending_verification.
 *  - Data yang ambigu -> bucket "perlu_ditinjau" dan label "Perlu ditinjau".
 *    Jangan pernah auto-transition berisiko dari data yang kabur.
 *
 * @see docs/audit-admin/admin-dashboard-status-transition-matrix.md
 */
class OrderStatusView
{
    public const BUCKET_PAID = 'paid';
    public const BUCKET_TRANSFER_UNPAID = 'transfer_unpaid';
    public const BUCKET_COD_PENDING = 'cod_pending';
    public const BUCKET_NEED_REVIEW = 'needs_review';

    /**
     * Bucket pembayaran yang sifatnya derivasi dari order.
     *
     * @param  Order|array<string,mixed>|object  $order  Model, array, atau objek dgn key yang dijamin ada.
     */
    public static function paymentBucket(array|object $order): string
    {
        $o = $order instanceof Order ? $order : (object) $order;
        $paymentStatus = $o->payment_status ?? 'pending';
        $codFlag = (bool) ($o->cod_flag ?? false);
        $paymentMethod = strtolower((string) ($o->payment_method ?? ''));
        $orderStatus = $o->order_status ?? '';

        // Order tidak lagi berjalan (dibatalkan atau perlu perhatian): pembayaran bukan
        // pekerjaan aktif. Jangan tampilkan sebagai unpaid/COD-pending yang menyesatkan.
        if (in_array($orderStatus, ['cancelled', 'issue', 'return_completed'], true)) {
            return self::BUCKET_NEED_REVIEW;
        }

        // Lunas / pembayaran selesai.
        if (in_array($paymentStatus, ['paid', 'completed', 'settled'], true)) {
            return self::BUCKET_PAID;
        }

        // COD belum dibayar -> "bayar saat barang diterima" (bukan unpaid transfer).
        if ($codFlag || $paymentMethod === 'cod') {
            return self::BUCKET_COD_PENDING;
        }

        // Transfer belum dibayar: hanya aman ketika order masih menunggu konfirmasi.
        if (
            $paymentStatus === 'pending'
            && $orderStatus === 'awaiting_confirmation'
        ) {
            return self::BUCKET_TRANSFER_UNPAID;
        }

        // Kondisi lain yang tidak bisa dipetakkan dengan pasti (mis. transfer pending
        // tapi sudah processing, atau status yang tak dikenal) -> minta ditinjau.
        return self::BUCKET_NEED_REVIEW;
    }

    /**
     * Label UI yang aman (tidak overclaim) untuk bucket pembayaran.
     */
    public static function paymentLabel(array|object $order): string
    {
        return match (self::paymentBucket($order)) {
            self::BUCKET_PAID => 'Lunas',
            self::BUCKET_COD_PENDING => 'COD, bayar saat barang diterima',
            self::BUCKET_TRANSFER_UNPAID => 'Menunggu pembayaran',
            default => 'Perlu ditinjau',
        };
    }

    /**
     * Kategori status "perlu tindakan" yang aman dipakai di dashboard action center.
     * Hanya memakai mapping existing; TIDAK menciptakan queue payment-verification.
     *
     * @return list<string> daftar order_status yang sesuai bucket
     */
    public static function orderStatusesForBucket(string $bucket): array
    {
        return match ($bucket) {
            self::BUCKET_TRANSFER_UNPAID => ['awaiting_confirmation'],
            self::BUCKET_COD_PENDING => ['awaiting_confirmation'],
            default => [],
        };
    }
}