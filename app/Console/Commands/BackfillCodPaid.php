<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

/**
 * Backfill COD: order COD yang shipping-nya sudah `delivered` (berdasarkan
 * shipping_records.last_status_at bukan null) tapi payment_status = pending,
 * diubah menjadi paid. Idempotent & aman diulang.
 *
 * Dasar: docs/desain-teknis-retur-sprint2.md (Paket 1, backfill COD).
 */
class BackfillCodPaid extends Command
{
    protected $signature = 'retur:backfill-cod-paid {--dry-run : tampilkan jumlah tanpa mengubah}';

    protected $description = 'Ubah payment_status order COD yang sudah delivered menjadi paid';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $orders = Order::query()
            ->where('payment_method', 'cod')
            ->where('payment_status', 'pending')
            ->whereIn('order_status', ['delivered', 'completed'])
            ->with(['shippingRecords' => fn ($q) => $q->where('status', 'delivered')])
            ->get();

        $affected = collect();

        foreach ($orders as $order) {
            $delivered = $order->shippingRecords->first(
                fn ($record) => $record->status === 'delivered' && $record->last_status_at !== null
            );
            if (! $delivered) {
                continue;
            }

            if (! $dryRun) {
                $order->update([
                    'payment_status' => 'paid',
                    'updated_by_user_id' => null,
                ]);
            }

            $affected->push([
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->order_status,
                'delivered_at' => optional($delivered->last_status_at)->toDateTimeString(),
            ]);
        }

        if ($dryRun) {
            $this->info('DRY RUN: '.$affected->count().' order COD layak menjadi paid.');
            $this->table(['id', 'order_number', 'status', 'delivered_at'], $affected->all());
        } else {
            $this->info('Backfill COD: '.$affected->count().' order diubah menjadi paid.');
            $this->table(['id', 'order_number', 'status', 'delivered_at'], $affected->all());
        }

        return self::SUCCESS;
    }
}