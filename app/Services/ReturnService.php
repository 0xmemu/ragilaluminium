<?php

namespace App\Services;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderReturnCase;
use App\Models\Payment;
use App\Models\ShippingRecord;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * ReturnService - service & validasi bisnis retur (Sprint 2, blueprint
 * docs/desain-teknis-retur-sprint2.md).
 *
 * Paket 2 fokus service & validasi (tanpa endpoint HTTP). Mencakup:
 *  - Transisi delivered -> COD paid (idempotent).
 *  - canCreateReturn (hanya delivered; batas 48 jam dan status lunas
 *    dilaporkan sebagai warnings, bukan penghalang, sejak skema retur
 *    full manual 2026-09-21).
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
     * PRIMARY (kontrak revisi 2026-08-25): COD lunas saat shipping DELIVERED.
     *
     * Dipanggil dari ShippingService::cascadeOrderStatus saat status -> delivered
     * (webhook J&T / refresh). Idempotent:
     *  - skip non-COD, non-delivered, atau yang sudah paid;
     *  - menulis/update SATU payment record (status completed, paid_at = waktu
     *    delivered) lalu menandai order paid - dalam satu transaction.
     */
    /**
     * Pesanan ditolak/dikembalikan kurir sebelum diterima dan belum lunas:
     * buat kasus retur otomatis supaya penutupan retur tetap terdokumentasi
     * lewat form retur yang sama (keputusan owner 2026-09-19, tanpa restore
     * stok karena barang kembali utuh).
     *
     * Idempoten: skip bila sudah ada kasus retur aktif untuk order ini.
     */
    public function openRefusedReturnCase(Order $order): bool
    {
        $hasActive = OrderReturnCase::query()
            ->where('order_id', $order->id)
            ->where('status', 'open')
            ->exists();

        if ($hasActive) {
            return false;
        }

        $created = false;

        DB::transaction(function () use ($order, &$created): void {
            $locked = Order::query()->lockForUpdate()->find($order->id);
            if (! $locked) {
                return;
            }
            $hasActiveInside = OrderReturnCase::query()
                ->where('order_id', $locked->id)
                ->where('status', 'open')
                ->exists();
            if ($hasActiveInside) {
                return;
            }


            $locked->load('items');

            $case = OrderReturnCase::create([
                'order_id' => $locked->id,
                'status' => 'open',
                'reason' => 'ditolak',
                'reason_detail' => 'Otomatis: paket dikembalikan kurir sebelum diterima pembeli (scan returned J&T).',
                'fault_party' => 'other',
                'shipping_cost_borne_by_store' => true,
                'customer_notes' => 'Paket dikembalikan ke pengirim oleh kurir.',
                'admin_notes' => null,
                'created_by_user_id' => null,
                'updated_by_user_id' => null,
            ]);

            foreach ($locked->items as $item) {
                $case->items()->create([
                    'order_item_id' => $item->id,
                    'requested_quantity' => (int) $item->quantity,
                    'returned_quantity' => 0,
                ]);
            }

            $created = true;
        });

        return $created;
    }

    public function markDeliveredAndSettleCod(Order $order, bool $persist = true): bool
    {
        $isCod = $order->cod_flag || $order->payment_method === 'cod';
        $isDelivered = $order->order_status === 'delivered'
            || $order->shipping_status === 'delivered';

        // Hanya COD yang benar-benar delivered dan masih pending yang dilunasi.
        if (! $isCod || ! $isDelivered || $order->payment_status === 'paid') {
            return false;
        }

        if (! $persist) {
            return true;
        }

        DB::transaction(function () use ($order): void {
            $locked = Order::query()->lockForUpdate()->find($order->id);
            if (! $locked) {
                return;
            }

            $isCod = $locked->cod_flag || $locked->payment_method === 'cod';
            $isDelivered = $locked->order_status === 'delivered'
                || $locked->shipping_status === 'delivered';
            if (! $isCod || ! $isDelivered || $locked->payment_status === 'paid') {
                return;
            }

            $payment = $locked->payments()
                ->where('payment_method', 'cod')
                ->whereIn('status', ['pending', 'completed'])
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if (! $payment) {
                $payment = Payment::create([
                    'order_id' => $locked->id,
                    'payment_method' => 'cod',
                    'amount' => $locked->total_amount,
                    'status' => 'pending',
                ]);
            }

            $paidAt = $this->codDeliveredAt($locked) ?? now();

            $payment->update([
                'amount' => $locked->total_amount,
                'status' => 'completed',
                'paid_at' => $payment->paid_at ?? $paidAt,
                'created_by_user_id' => null,
                'updated_by_user_id' => null,
            ]);

            $locked->update([
                'payment_status' => 'paid',
                'updated_by_user_id' => null,
            ]);

            EventLog::create([
                'event_type' => 'system/cod_settlement',
                'entity_type' => 'order',
                'entity_id' => $locked->id,
                'payload' => [
                    'payment_id' => $payment->id,
                    'payment_method' => 'cod',
                    'amount' => (float) $locked->total_amount,
                    'source' => 'shipping_delivered',
                ],
                'created_by_user_id' => null,
                'created_at' => now(),
            ]);
        });

        return true;
    }

    /**
     * Waktu delivered terakhir dari shipping record (jumlahkan waktu kejadian).
     */
    protected function codDeliveredAt(Order $order): ?Carbon
    {
        $shipping = $order->shippingRecords
            ->first(fn ($r) => $r->status === 'delivered' && $r->last_status_at !== null);

        return $shipping?->last_status_at !== null
            ? Carbon::parse($shipping->last_status_at)
            : null;
    }

    /**
     * Kebijakan resmi retur untuk sebuah pesanan.
     *
     * Skema retur full manual (keputusan owner 2026-09-21): keputusan retur
     * diambil admin setelah diskusi WhatsApp, jadi satu-satunya syarat yang
     * mengikat di sini adalah status pesanan sudah Sampai. Batas 48 jam dan
     * status lunas tetap dihitung supaya bisa ditampilkan sebagai peringatan,
     * bukan sebagai penolakan. `allowed` menjawab "boleh mengajukan tombol
     * pengembalian?", bukan "masih di dalam kebijakan".
     *
     * @return array{allowed: bool, reason?: string, deadline?: string, warnings?: list<string>}
     */
    public function canCreateReturn(Order $order, ?ShippingRecord $shippingRecord = null, ?Carbon $now = null): array
    {
        if ($order->order_status !== 'delivered') {
            return [
                'allowed' => false,
                'reason' => 'Retur hanya dapat diajukan untuk pesanan berstatus Sampai.',
                'warnings' => [],
            ];
        }

        $shipping = $shippingRecord
            ?? $order->shippingRecords
                ->first(fn ($r) => $r->status === 'delivered' && $r->last_status_at !== null);

        $warnings = [];

        if (! $shipping || $shipping->status !== 'delivered' || $shipping->last_status_at === null) {
            $warnings[] = 'Waktu paket sampai belum tercatat di sistem.';

            return ['allowed' => true, 'deadline' => null, 'warnings' => $warnings];
        }

        $now = $now ?? now();
        $deadline = $shipping->last_status_at->copy()->addHours(self::RETURN_WINDOW_HOURS);

        if ($now->gt($deadline)) {
            $warnings[] = 'Sudah lewat batas retur '.self::RETURN_WINDOW_HOURS.' jam sejak paket sampai.';
        }

        if ($order->payment_status !== 'paid') {
            $warnings[] = 'Pembayaran pesanan ini belum tercatat lunas.';
        }

        return [
            'allowed' => true,
            'deadline' => $deadline->toIso8601String(),
            'warnings' => $warnings,
        ];
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