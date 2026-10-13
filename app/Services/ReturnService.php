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
        $kasus = null;

        DB::transaction(function () use ($order, &$created, &$kasus): void {
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

            // Item 5 antrean: retur kurir setelah paket sempat diterima punya
            // makna uang berbeda (COD sudah lunas), jadi keterangannya wajib
            // tidak menyebut "sebelum diterima".
            $pernahDiterima = $locked->shippingRecords()
                ->where('status', 'delivered')
                ->exists() || $locked->payment_status === 'paid';

            $case = OrderReturnCase::create([
                'order_id' => $locked->id,
                'status' => 'open',
                'reason' => 'ditolak',
                'reason_detail' => $pernahDiterima
                    ? 'Otomatis: paket dikembalikan kurir setelah sempat diterima pembeli (scan returned J&T).'
                    : 'Otomatis: paket dikembalikan kurir sebelum diterima pembeli (scan returned J&T).',
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
            $kasus = $case;
        });

        if ($created && $kasus) {
            // Item 4 antrean: kasus retur otomatis tidak boleh senyap. Event
            // yang sama dengan retur manual memicu notifikasi return_created
            // (idempoten per kasus) tanpa efek samping WhatsApp.
            \App\Events\OrderReturnCreated::dispatch($order->fresh(), $kasus->fresh() ?? $kasus);
        }

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
     * Tanpa batas maksimal nominal. Nilainya PENGURANG Penjualan Bersih
     * (keputusan owner 2026-09-28) tanpa mengubah Penjualan Gross.
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

    /**
     * Total refund kasus retur lain yang MASIH dihitung laporan untuk pesanan
     * ini: status completed, belum di-void, tidak termasuk kasus yang sedang
     * diedit. Dipakai supaya refund kumulatif lintas kasus tidak pernah
     * melebihi pembayaran yang tercatat lunas.
     */
    public function refundedExcludingCase(Order $order, ?int $excludeCaseId = null): float
    {
        return (float) OrderReturnCase::query()
            ->where('order_id', $order->id)
            ->where('status', 'completed')
            ->whereNull('voided_at')
            ->when($excludeCaseId, fn ($query) => $query->where('id', '!=', $excludeCaseId))
            ->sum('refund_amount');
    }

    /**
     * Koreksi data administratif kasus retur SELESAI (instruksi owner
     * 2026-09-28). Status workflow tidak disentuh: kasus tetap "completed",
     * pesanan tetap "return_completed". Yang boleh berubah hanya data kasus,
     * dan setiap perubahan field meninggalkan satu baris audit di tabel
     * return_case_adjustments (nilai lama, nilai baru, alasan, pelaku).
     *
     * Stok pengganti TIDAK disentuh sama sekali: koreksi tidak memotong stok
     * lagi dan tidak membalikkan pemotongan lama (pembalikan stok butuh
     * keputusan eksplisit owner). Refund juga tidak membuat mutasi kas; yang
     * diperbarui hanya pencatatan laporan.
     *
     * @param  array<string, mixed>  $data  field terpilih + adjustment_reason
     * @return OrderReturnCase kasus yang sudah diperbarui
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function updateReturnCase(Order $order, OrderReturnCase $case, array $data, int $actorId): OrderReturnCase
    {
        if ((int) $case->order_id !== (int) $order->id) {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['return' => 'Kasus retur tidak cocok dengan pesanan.']
            );
        }

        if ($case->status !== 'completed' || $case->voided_at !== null) {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['return' => 'Hanya kasus retur selesai yang belum di-void yang dapat dikoreksi.']
            );
        }

        $alasan = trim((string) ($data['adjustment_reason'] ?? ''));
        if ($alasan === '') {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['adjustment_reason' => 'Alasan koreksi wajib diisi.']
            );
        }

        $reason = trim((string) ($data['reason'] ?? $case->reason));
        $reasonDetail = array_key_exists('reason_detail', $data)
            ? (filled($data['reason_detail']) ? trim((string) $data['reason_detail']) : null)
            : $case->reason_detail;
        $reasonCheck = $this->validateReason($reason, $reasonDetail);
        if (! $reasonCheck['valid']) {
            throw \Illuminate\Validation\ValidationException::withMessages(['reason' => $reasonCheck['error']]);
        }

        $faultParty = (string) ($data['fault_party'] ?? $case->fault_party);
        if (! in_array($faultParty, ['store', 'customer', 'other'], true)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['fault_party' => 'Pihak penyebab tidak valid.']);
        }

        $resolution = (string) ($data['resolution_type'] ?? $case->resolution_type);
        if (! in_array($resolution, ['refund', 'replacement', 'reship', 'compensation', 'no_compensation'], true)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['resolution_type' => 'Jenis resolusi tidak valid.']);
        }

        $refund = (float) ($data['refund_amount'] ?? $case->refund_amount);
        $ongkir = (float) ($data['return_shipping_cost'] ?? $case->return_shipping_cost);
        $replacement = (float) ($data['replacement_amount'] ?? $case->replacement_amount);

        if (! is_numeric($refund) || $refund < 0) {
            throw \Illuminate\Validation\ValidationException::withMessages(['refund_amount' => 'Nominal refund tidak boleh negatif.']);
        }

        // Non-refund (replacement, reship, tanpa kompensasi) wajib refund 0.
        if (! in_array($resolution, ['refund', 'compensation'], true) && $refund > 0) {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['refund_amount' => 'Resolusi tanpa pengembalian dana wajib bernilai refund 0.']
            );
        }

        // Refund hanya untuk pesanan lunas, dan refund kumulatif seluruh kasus
        // yang masih dihitung (kasus lain + nilai baru ini) tidak boleh
        // melebihi pembayaran yang tercatat.
        if ($refund > 0) {
            if ($order->payment_status !== 'paid') {
                throw \Illuminate\Validation\ValidationException::withMessages(
                    ['refund_amount' => 'Refund hanya dapat dicatat untuk pesanan yang sudah lunas.']
                );
            }
            $paidSum = (float) $order->payments()->where('status', 'completed')->sum('amount');
            $refundLain = $this->refundedExcludingCase($order, $case->id);
            $maxRefund = max(0.0, min((float) $order->total_amount, $paidSum) - $refundLain);
            if ($refund > $maxRefund + 0.0001) {
                throw \Illuminate\Validation\ValidationException::withMessages(
                    ['refund_amount' => 'Refund kumulatif melebihi pembayaran tercatat. Sisa kuota refund kasus ini: Rp '.number_format($maxRefund, 0, ',', '.').'.']
                );
            }
        }

        $ongkirCheck = $this->validateReturnShippingCost($faultParty, $ongkir);
        if (! $ongkirCheck['valid']) {
            throw \Illuminate\Validation\ValidationException::withMessages(['return_shipping_cost' => $ongkirCheck['error']]);
        }
        if ($ongkir < 0) {
            throw \Illuminate\Validation\ValidationException::withMessages(['return_shipping_cost' => 'Ongkir retur tidak boleh negatif.']);
        }

        if ($replacement < 0) {
            throw \Illuminate\Validation\ValidationException::withMessages(['replacement_amount' => 'Nilai penggantian tidak boleh negatif.']);
        }
        if ($replacement > 0 && ! in_array($resolution, ['replacement', 'reship'], true)) {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['replacement_amount' => 'Nilai penggantian hanya boleh diisi untuk resolusi ganti barang atau kirim ulang.']
            );
        }

        $baru = [
            'reason' => $reason,
            'reason_detail' => $reasonDetail,
            'customer_notes' => array_key_exists('customer_notes', $data)
                ? (filled($data['customer_notes']) ? trim((string) $data['customer_notes']) : null)
                : $case->customer_notes,
            'fault_party' => $faultParty,
            'resolution_type' => $resolution,
            'refund_amount' => $refund,
            'return_shipping_cost' => $ongkir,
            'replacement_amount' => $replacement,
        ];

        return DB::transaction(function () use ($case, $baru, $alasan, $actorId): OrderReturnCase {
            $terkunci = OrderReturnCase::query()->lockForUpdate()->findOrFail($case->id);
            if ($terkunci->status !== 'completed' || $terkunci->voided_at !== null) {
                throw \Illuminate\Validation\ValidationException::withMessages(
                    ['return' => 'Kasus retur sudah tidak dapat dikoreksi.']
                );
            }

            foreach ($baru as $field => $nilai) {
                $lama = $terkunci->{$field};
                // Kolom uang ber-cast decimal:2 sehingga nilai lamanya string
                // "50000.00"; bandingkan sebagai angka supaya nilai sama tidak
                // menulis baris audit palsu.
                $sama = is_numeric($lama) && is_numeric($nilai)
                    ? abs((float) $lama - (float) $nilai) < 0.0001
                    : ((string) $lama) === ((string) $nilai);

                if ($sama) {
                    continue;
                }

                \App\Models\ReturnCaseAdjustment::create([
                    'return_case_id' => $terkunci->id,
                    'field' => $field,
                    'old_value' => $lama === null ? null : (string) $lama,
                    // Angka diseragamkan dua desimal supaya nilainya sejajar
                    // dengan representasi kolom uang di kasus (decimal:2).
                    'new_value' => is_numeric($nilai) && ! is_string($nilai)
                        ? number_format((float) $nilai, 2, '.', '')
                        : ($nilai === null ? null : (string) $nilai),
                    'reason' => $alasan,
                    'changed_by_user_id' => $actorId,
                ]);
            }

            $terkunci->fill($baru);
            $terkunci->updated_by_user_id = $actorId;
            $terkunci->save();

            return $terkunci;
        });
    }

    /**
     * Tutup kasus retur secara administratif TANPA menghapus riwayat.
     *
     * - Kasus open menjadi "cancelled": aman karena refund dan pemotongan
     *   stok pengganti hanya pernah terjadi pada penyelesaian (kasus completed),
     *   jadi kasus open pasti belum menyentuh uang maupun stok.
     * - Kasus completed di-void: status workflow TETAP "completed" (terminal),
     *   tetapi voided_at diisi sehingga seluruh laporan berhenti menghitungnya.
     *   Tidak ada pembalikan stok dan tidak ada refund otomatis.
     *
     * @return string "cancelled" untuk kasus open, "voided" untuk kasus selesai
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function voidReturnCase(Order $order, OrderReturnCase $case, string $reason, int $actorId): string
    {
        if ((int) $case->order_id !== (int) $order->id) {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['return' => 'Kasus retur tidak cocok dengan pesanan.']
            );
        }

        $alasan = trim($reason);
        if ($alasan === '') {
            throw \Illuminate\Validation\ValidationException::withMessages(
                ['void_reason' => 'Alasan penutupan kasus wajib diisi.']
            );
        }

        return DB::transaction(function () use ($alasan, $actorId, $case): string {
            $terkunci = OrderReturnCase::query()->lockForUpdate()->findOrFail($case->id);

            if ($terkunci->voided_at !== null) {
                throw \Illuminate\Validation\ValidationException::withMessages(
                    ['return' => 'Kasus retur ini sudah ditutup sebelumnya.']
                );
            }

            if ($terkunci->status === 'open') {
                $terkunci->status = 'cancelled';
                $mode = 'cancelled';
            } elseif ($terkunci->status === 'completed') {
                // Status workflow tidak diubah: return_completed tetap terminal.
                // Void hanya menandai kasus agar tidak dihitung laporan lagi.
                $mode = 'voided';
            } else {
                throw \Illuminate\Validation\ValidationException::withMessages(
                    ['return' => 'Status kasus retur tidak dapat ditutup.']
                );
            }

            $terkunci->voided_at = now();
            $terkunci->voided_by_user_id = $actorId;
            $terkunci->void_reason = $alasan;
            $terkunci->updated_by_user_id = $actorId;
            $terkunci->save();

            \App\Models\ReturnCaseAdjustment::create([
                'return_case_id' => $terkunci->id,
                'field' => 'void',
                'old_value' => $mode === 'cancelled' ? 'open' : 'completed',
                'new_value' => $mode,
                'reason' => $alasan,
                'changed_by_user_id' => $actorId,
            ]);

            return $mode;
        });
    }

    /**
     * Validasi alasan pengecualian retur manual untuk pesanan yang sudah
     * Selesai (jalur admin khusus). Alasan wajib supaya setiap keterlambatan
     * punya kronologi yang bisa diaudit.
     *
     * @return array{valid: bool, error?: string}
     */
    public function validateLateReturnOverride(?string $overrideReason): array
    {
        if (trim((string) $overrideReason) === '') {
            return ['valid' => false, 'error' => 'Alasan pengecualian wajib diisi untuk retur manual pesanan Selesai.'];
        }

        return ['valid' => true];
    }
}