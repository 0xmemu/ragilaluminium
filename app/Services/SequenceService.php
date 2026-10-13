<?php

namespace App\Services;

use App\Models\OrderNumberSequence;
use Illuminate\Support\Facades\DB;

/**
 * Penomoran berurutan anti-bentrok (SPESIFIKASI-FINAL ??E, keputusan #14).
 * Sequence disimpan per kunci (mis. "order-20260809") dan dinaikkan dalam
 * transaksi terkunci sehingga nomor tidak pernah terpakai ulang.
 */
final class SequenceService
{
    public function next(string $key): int
    {
        return DB::transaction(function () use ($key): int {
            $record = OrderNumberSequence::query()
                ->lockForUpdate()
                ->where('sequence_key', $key)
                ->first();

            if ($record === null) {
                $record = OrderNumberSequence::create(['sequence_key' => $key, 'seq' => 0]);
            }

            $record->increment('seq');
            $record->refresh();

            return (int) $record->seq;
        });
    }

    public function current(string $key): int
    {
        return (int) (OrderNumberSequence::query()
            ->where('sequence_key', $key)
            ->value('seq') ?? 0);
    }
}

