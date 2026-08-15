<?php

namespace App\Services;

use App\Domain\Orders\OrderStateMachine;
use App\Events\PaymentConfirmed;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(private readonly OrderStateMachine $states) {}

    /**
     * Tandai satu payment selesai lalu lunasi order hanya jika total settlement cukup.
     * Order dan seluruh payment dikunci agar request admin paralel tetap konsisten.
     */
    public function markCompleted(Order $order, Payment $payment, int $userId): void
    {
        $confirmation = null;

        DB::transaction(function () use ($order, $payment, $userId, &$confirmation) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            $payment = Payment::query()
                ->where('order_id', $order->id)
                ->lockForUpdate()
                ->findOrFail($payment->id);

            if ((float) $payment->amount <= 0) {
                throw new \DomainException('Nominal pembayaran harus lebih dari nol.');
            }

            if ((float) $order->total_amount <= 0) {
                throw new \DomainException('Total pesanan harus lebih dari nol untuk dikonfirmasi lunas.');
            }

            if ($payment->status !== 'completed') {
                $payment->update([
                    'status' => 'completed',
                    'paid_at' => $payment->paid_at ?? now(),
                    'updated_by_user_id' => $userId,
                ]);
            }

            $payments = $order->payments()->lockForUpdate()->get(['status', 'amount']);
            $settledAmount = (float) $payments
                ->where('status', 'completed')
                ->sum(fn (Payment $item): float => (float) $item->amount);

            if ($settledAmount + 0.0001 < (float) $order->total_amount) {
                if ($order->payment_status !== 'pending') {
                    $order->update([
                        'payment_status' => 'pending',
                        'updated_by_user_id' => $userId,
                    ]);
                }

                return;
            }

            $alreadyPaid = $order->payment_status === 'paid';
            $order->update([
                'payment_status' => 'paid',
                'updated_by_user_id' => $userId,
            ]);

            if ($order->order_status === 'pending_payment') {
                $this->states->transition(
                    $order,
                    'processing',
                    $userId,
                    'payment_settled',
                    ['payment_id' => $payment->id],
                );
            }

            if (! $alreadyPaid) {
                EventLog::create([
                    'event_type' => 'payment.confirmed',
                    'entity_type' => 'order',
                    'entity_id' => $order->id,
                    'payload' => [
                        'payment_id' => $payment->id,
                        'amount' => $payment->amount,
                        'settled_amount' => $settledAmount,
                        'required_amount' => (float) $order->total_amount,
                    ],
                    'created_by_user_id' => $userId,
                    'created_at' => now(),
                ]);

                $confirmation = [$order->fresh(), $payment->fresh()];
            }
        });

        if ($confirmation !== null) {
            PaymentConfirmed::dispatch($confirmation[0], $confirmation[1]);
        }
    }

    /**
     * Sinkronkan status order setelah payment menjadi pending/failed/refunded.
     * Status order fulfillment tidak diregresikan otomatis.
     */
    public function reconcile(Order $order, int $userId): void
    {
        DB::transaction(function () use ($order, $userId) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            $payments = $order->payments()->lockForUpdate()->get(['status', 'amount']);

            $completedAmount = (float) $payments
                ->where('status', 'completed')
                ->sum(fn (Payment $item): float => (float) $item->amount);
            $refundedAmount = (float) $payments
                ->where('status', 'refunded')
                ->sum(fn (Payment $item): float => (float) $item->amount);

            $nextStatus = match (true) {
                (float) $order->total_amount > 0
                    && $completedAmount + 0.0001 >= (float) $order->total_amount => 'paid',
                $refundedAmount > 0 && $completedAmount <= 0 => 'refunded',
                default => 'pending',
            };

            if ($order->payment_status === $nextStatus) {
                return;
            }

            $from = $order->payment_status;
            $order->update([
                'payment_status' => $nextStatus,
                'updated_by_user_id' => $userId,
            ]);

            EventLog::create([
                'event_type' => 'payment.reconciled',
                'entity_type' => 'order',
                'entity_id' => $order->id,
                'payload' => [
                    'from' => $from,
                    'payment_status' => $nextStatus,
                    'completed_amount' => $completedAmount,
                    'refunded_amount' => $refundedAmount,
                    'required_amount' => (float) $order->total_amount,
                ],
                'created_by_user_id' => $userId,
                'created_at' => now(),
            ]);
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

        $payment = DB::transaction(function () use ($order, $userId, $method) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            $payment = $order->payments()
                ->where('status', 'pending')
                ->lockForUpdate()
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

            return $payment;
        });

        $this->markCompleted($order->fresh(), $payment->fresh(), $userId);

        return $payment->fresh();
    }

    /**
     * Settle COD exactly when fulfillment reaches completed.
     *
     * This is deliberately system-owned: no admin user is required and the
     * audit event remains idempotent under repeated status requests.
     */
    public function completeCodAtCompletion(Order $order): Payment
    {
        $payment = DB::transaction(function () use ($order): Payment {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            if ($lockedOrder->order_status !== 'completed') {
                throw new DomainException('COD hanya dapat diselesaikan saat pesanan completed.');
            }

            if ($lockedOrder->payment_status === 'paid') {
                return $lockedOrder->payments()
                    ->where('payment_method', 'cod')
                    ->where('status', 'completed')
                    ->latest('id')
                    ->firstOrFail();
            }

            $payment = $lockedOrder->payments()
                ->where('payment_method', 'cod')
                ->whereIn('status', ['pending', 'completed'])
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if (! $payment) {
                $payment = Payment::create([
                    'order_id' => $lockedOrder->id,
                    'payment_method' => 'cod',
                    'amount' => $lockedOrder->total_amount,
                    'status' => 'pending',
                ]);
            }

            $payment->update([
                'amount' => $lockedOrder->total_amount,
                'status' => 'completed',
                'paid_at' => $payment->paid_at ?? now(),
                'created_by_user_id' => null,
                'updated_by_user_id' => null,
            ]);

            $lockedOrder->update([
                'payment_status' => 'paid',
                'updated_by_user_id' => null,
            ]);

            EventLog::create([
                'event_type' => 'system/cod_completion',
                'entity_type' => 'order',
                'entity_id' => $lockedOrder->id,
                'payload' => [
                    'payment_id' => $payment->id,
                    'payment_method' => 'cod',
                    'amount' => (float) $lockedOrder->total_amount,
                    'total_amount' => (float) $lockedOrder->total_amount,
                    'source' => 'order_completed',
                ],
                'created_by_user_id' => null,
                'created_at' => now(),
            ]);

            return $payment->fresh();
        });

        PaymentConfirmed::dispatch($order->fresh(), $payment->fresh());

        return $payment;
    }
}
