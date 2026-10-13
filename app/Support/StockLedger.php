<?php

namespace App\Support;

use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

/**
 * Ledger mutasi stok (P2-3.1).
 *
 * Ganti panggilan `$variant->decrement/increment('stock', $n)` lintas bisnis
 * dengan StockLedger::apply() agar setiap perubahan stok tercatat
 * (before/after/delta/type/reference) dalam satu transaction + lock row.
 */
final class StockLedger
{
    public static function apply(
        ProductVariant $variant,
        int $quantity,
        string $movementType,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $reason = null,
    ): void {
        DB::transaction(function () use ($variant, $quantity, $movementType, $referenceType, $referenceId, $reason): void {
            $locked = ProductVariant::query()->lockForUpdate()->find($variant->id);
            if (! $locked) {
                return;
            }

            $before = (int) $locked->stock;
            $after = max(0, $before + $quantity);

            $locked->update(['stock' => $after]);

            StockMovement::create([
                'product_variant_id' => $locked->id,
                'stock_before' => $before,
                'stock_after' => $after,
                'quantity' => $quantity,
                'movement_type' => $movementType,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'reason' => $reason,
                'changed_by_user_id' => optional(auth()->user())->id,
                'created_at' => now(),
            ]);
        });
    }
}