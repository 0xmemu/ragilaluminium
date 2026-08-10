<?php

namespace App\Domain\Orders;

use App\Models\EventLog;
use App\Models\Order;
use Closure;
use DomainException;
use Illuminate\Support\Facades\DB;

class OrderStateMachine
{
    /** @var array<string, list<string>> */
    private const ORDER_TRANSITIONS = [
        'pending_payment' => ['processing', 'issue', 'cancelled'],
        'processing' => ['shipped', 'issue', 'cancelled'],
        'shipped' => ['delivered', 'issue', 'return_in_process'],
        'delivered' => ['completed', 'issue', 'return_in_process'],
        'issue' => ['processing', 'shipped', 'delivered', 'return_in_process'],
        'return_in_process' => ['completed', 'issue', 'return_completed'],
        // Retur Selesai: terminal — pesanan ditutup sebagai retur (tab "Retur Selesai").
        'return_completed' => [],
        'completed' => [],
        'cancelled' => [],
    ];

    /** @var array<string, list<string>> */
    private const CARRIER_ORDER_TRANSITIONS = [
        'processing' => ['delivered', 'return_in_process'],
    ];

    /** @var array<string, list<string>> */
    private const SHIPPING_TRANSITIONS = [
        'pending_pickup' => ['in_process', 'in_transit', 'delivered', 'returned', 'cancelled'],
        'in_process' => ['in_transit', 'delivered', 'returned', 'cancelled'],
        'in_transit' => ['delivered', 'returned', 'cancelled'],
        'delivered' => ['returned'],
        'returned' => [],
        'cancelled' => [],
    ];

    public function canTransition(Order|string $order, string $to, string $source = 'admin'): bool
    {
        $from = $order instanceof Order ? $order->order_status : $order;

        if ($from === $to) {
            return array_key_exists($from, self::ORDER_TRANSITIONS);
        }

        $allowed = self::ORDER_TRANSITIONS[$from] ?? [];

        if ($source === 'carrier') {
            $allowed = array_values(array_unique([
                ...$allowed,
                ...(self::CARRIER_ORDER_TRANSITIONS[$from] ?? []),
            ]));
        }

        return in_array($to, $allowed, true);
    }

    public function canTransitionShipping(string $from, string $to): bool
    {
        if ($from === $to) {
            return array_key_exists($from, self::SHIPPING_TRANSITIONS);
        }

        return in_array($to, self::SHIPPING_TRANSITIONS[$from] ?? [], true);
    }

    /**
     * @param  array<string, bool|float|int|string|null>  $context
     * @param  (Closure(Order): void)|null  $beforeTransition
     */
    public function transition(
        Order $order,
        string $to,
        ?int $actorUserId,
        string $source,
        array $context = [],
        ?Closure $beforeTransition = null,
    ): bool {
        return DB::transaction(function () use ($order, $to, $actorUserId, $source, $context, $beforeTransition): bool {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $from = $lockedOrder->order_status;

            if ($from === $to) {
                return false;
            }

            if (! $this->canTransition($from, $to, $source)) {
                throw new DomainException("Transisi status pesanan {$from} → {$to} tidak diizinkan.");
            }

            if ($beforeTransition !== null) {
                $beforeTransition($lockedOrder);
            }

            $lockedOrder->update([
                'order_status' => $to,
                'updated_by_user_id' => $actorUserId,
            ]);

            EventLog::create([
                'event_type' => 'order_status_changed',
                'entity_type' => 'order',
                'entity_id' => $lockedOrder->id,
                'payload' => array_filter([
                    'from' => $from,
                    'order_status' => $to,
                    'source' => $source,
                    ...$context,
                ], fn (mixed $value): bool => $value !== null && $value !== ''),
                'created_by_user_id' => $actorUserId,
                'created_at' => now(),
            ]);

            return true;
        });
    }
}
