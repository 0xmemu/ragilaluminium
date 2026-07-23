<?php

namespace App\Services;

use App\Events\PaymentConfirmed;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    /**
     * Tandai pembayaran selesai + order lunas (idempotent).
     * Jika order masih pending_payment, majukan ke processing.
     */
    public function markCompleted(Order $order, Payment $payment, int $userId): void
    {
        DB::transaction(function () use ($order, $payment, $userId) {
            if ($payment->status !== 'completed') {
                $payment->update([
                    'status' => 'completed',
                    'paid_at' => $payment->paid_at ?? now(),
                    'updated_by_user_id' => $userId,
                ]);
            }

            $alreadyPaid = $order->payment_status === 'paid';

            $updates = ['payment_status' => 'paid', 'updated_by_user_id' => $userId];
            if ($order->order_status === 'pending_payment') {
                $updates['order_status'] = 'processing';
            }
            $order->update($updates);

            if (! $alreadyPaid) {
                EventLog::create([
                    'event_type' => 'payment.confirmed',
                    'entity_type' => 'order',
                    'entity_id' => $order->id,
                    'payload' => ['payment_id' => $payment->id, 'amount' => $payment->amount],
                    'created_by_user_id' => $userId,
                    'created_at' => now(),
                ]);

                PaymentConfirmed::dispatch($order->fresh(), $payment->fresh());
            }
        });
    }

    /**
     * Selesaikan pembayaran pending milik order (COD di akhir, transfer saat proses).
     * Membuat payment pending bila belum ada.
     */
    public function completePendingForOrder(Order $order, int $userId, ?string $preferredMethod = null): Payment
    {
        $method = $preferredMethod
            ?? ($order->cod_flag || $order->payment_method === 'cod' ? 'cod' : 'transfer');

        $payment = $order->payments()
            ->where('status', 'pending')
            ->latest('id')
            ->first();

        if (! $payment) {
            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => $method,
                'amount' => $order->total_amount,
                'status' => 'pending',
                'created_by_user_id' => $userId,
                'updated_by_user_id' => $userId,
            ]);
        }

        $this->markCompleted($order->fresh(), $payment->fresh(), $userId);

        return $payment->fresh();
    }
}
