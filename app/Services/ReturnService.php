<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Support\Carbon;

/**
 * ReturnService — service & validasi bisnis retur (Sprint 2, blueprint
 * docs/desain-teknis-retur-sprint2.md).
 *
 * Paket 2 fokus service & validasi (tanpa endpoint HTTP). Mencakup:
 *  - Transisi delivered -> COD paid (idempotent).
 *  - canCreateReturn (window 48 jam, hanya delivered, payment paid).
 *  - validateReason / reason_detail (wajib utk "lainnya").
 *  - defaultFaultParty berdasarkan reason.
 *  - validateRefundAmount (0 <= refund <= total_amount).
 *  - validateReplacementItems (item pengganti wajib lengkap).
 */
class ReturnService
{
    /**
     * Window retur dalam jam sejak shipping delivered.         */
    public const RETURN_WINDOW_HOURS = 48;

    /**
     * Pastikan order COD di-set `paid` saat pengiriman `delivered`.
     * Idempotent: tidak mengubah non-COD, tidak mengubah yang sudah paid.
     *
     * Dipanggil dari ShippingService::cascadeOrderStatus saat status -> delivered.
     */
    public function markDeliveredAndSettleCod(Order $order, bool $persist = true): bool
    {
        $isCod = $order->cod_flag || $order->payment_method === 'cod';
        $isDelivered = $order->order_status === 'delivered'
            || $order->shipping_status === 'delivered';

        // Hanya COD yang benar-benar delivered dan masih pending yang dilunasi.
        if (! $isCod || ! $isDelivered || $order->payment_status === 'paid') {
            return false;
        }

        if ($persist) {
            $order->update([
                'payment_status' => 'paid',
                'updated_by_user_id' => null,
            ]);
        }

        return true;
    }

    /**
     * Kelayakan membuat kasus retur.
     *
     * @return array{allowed: bool, reason?: string, deadline?: string}
     */
    public function canCreateReturn(Order $order, ?ShippingRecord $shippingRecord = null, ?Carbon $now = null): array
    {
        if ($order->order_status !== 'delivered') {
            return ['allowed' => false, 'reason' => 'Retur hanya dapat dicatat untuk pesanan berstatus Sampai.'];
        }

        $shipping = $shippingRecord
            ?? $order->shippingRecords
                ->first(fn ($r) => $r->status === 'delivered' && $r->last_status_at !== null);

        if (! $shipping || $shipping->status !== 'delivered' || $shipping->last_status_at === null) {
            return ['allowed' => false, 'reason' => 'Waktu paket sampai belum tersedia.'];
        }

        $now = $now ?? now();
        $deadline = $shipping->last_status_at->copy()->addHours(self::RETURN_WINDOW_HOURS);

        if ($now->gt($deadline)) {
            return ['allowed' => false, 'reason' => 'Batas retur 48 jam telah lewat. Tindak lanjuti melalui WhatsApp.'];
        }

        if ($order->payment_status !== 'paid') {
            return ['allowed' => false, 'reason' => 'Pesanan belum tercatat lunas.'];
        }

        return ['allowed' => true, 'deadline' => $deadline->toIso8601String()];
    }

    /**
     * Validasi alasan retur; "lainnya" wajib punya keterangan.
     *
     * @return array{valid: bool, error?: string}
     */
    public function validateReason(?string $reason, ?string $reasonDetail = null): array
    {
        $allowed = ['rusak', 'pecah', 'salah_ukuran', 'salah_produk', 'kurang', 'lainnya'];
        if (! in_array($reason, $allowed, true)) {
            return ['valid' => false, 'error' => 'Alasan retur tidak valid.'];
        }

        if ($reason === 'lainnya' && trim((string) $reasonDetail) === '') {
            return ['valid' => false, 'error' => 'Keterangan wajib diisi untuk alasan Lainnya.'];
        }

        return ['valid' => true];
    }

    /**
     * Default pihak yang dianggap bertanggung jawab berdasarkan reason.
     */
    public function defaultFaultParty(?string $reason): string
    {
        return in_array($reason, ['rusak', 'pecah', 'salah_ukuran', 'salah_produk', 'kurang'], true)
            ? 'store'
            : 'other';
    }

    /**
     * Validasi nominal refund: numerik, >= 0, <= total_amount.
     *
     * @return array{valid: bool, error?: string}
     */
    public function validateRefundAmount(mixed $refundAmount, float $totalAmount): array
    {
        if (! is_numeric($refundAmount) || (float) $refundAmount < 0) {
            return ['valid' => false, 'error' => 'Nominal refund harus bernilai nol atau lebih.'];
        }

        if ((float) $refundAmount > $totalAmount) {
            return ['valid' => false, 'error' => 'Nominal refund tidak boleh melebihi total pembayaran pesanan.'];
        }

        return ['valid' => true];
    }

    /**
     * Validasi item pengganti (replacement): semua wajib punya produk & qty >= 1.
     *
     * @param  array<int, array{
     *   replacement_product_id?: int|null,
     *   replacement_quantity?: int|null
     * }>  $items
     * @return array{valid: bool, error?: string}
     */
    public function validateReplacementItems(array $items): array
    {
        foreach ($items as $item) {
            $productId = $item['replacement_product_id'] ?? null;
            $quantity = $item['replacement_quantity'] ?? null;

            if (! $productId || ! is_numeric($quantity) || (int) $quantity < 1) {
                return ['valid' => false, 'error' => 'Item pengganti dan jumlahnya wajib lengkap.'];
            }
        }

        return ['valid' => true];
    }

    /**
     * Validasi ongkir retur yang ditanggung toko (dua opsi).
     *
     * - fault_party store -> wajib > 0 (kesalahan toko).
     * - fault_party customer/other -> opsional (goodwill, boleh 0 atau > 0).
     * Tanpa batas maksimal nominal. Tidak mengurangi omzet (biaya operasional).
     *
     * @return array{valid: bool, error?: string}
     */
    public function validateReturnShippingCost(string $faultParty, mixed $cost): array
    {
        $value = is_numeric($cost) ? (float) $cost : null;

        if ($faultParty === 'store') {
            if ($value === null || $value <= 0) {
                return ['valid' => false, 'error' => 'Ongkir retur wajib diisi karena kesalahan ada di toko.'];
            }

            return ['valid' => true];
        }

        // customer/other: opsional (goodwill). Null dianggap 0.
        return ['valid' => true];
    }
}