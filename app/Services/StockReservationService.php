<?php

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\StockReservation;
use Illuminate\Support\Carbon;

/**
 * Stock reservation subsystem (P2-3.2).
 *
 * AKTIF hanya bila config('operations.stock_reservation.enabled') true
 * (default false). Saat aktif, checkout dapat menahan stok selama window
 * hold (default 15 menit) sebelum order dikunci:
 *
 *  $res = app(StockReservationService::class)->hold($variant, $qty);
 *  ... order selesai -> ->confirmFor('checkout', $key);
 *  ... batal/expired -> ->release($res->id);
 *
 * Untuk keamanan produksi, integrasi ke OrderService TIDAK dilakukan di
 * task ini: mengubah alur order kritis butuh approval + pengujian beban.
 * Subsystem + test unit tersedia; aktivasi via config + integrasi bertahap.
 */
class StockReservationService
{
    public function __construct(protected int $holdMinutes = 15)
    {
    }

    public function enabled(): bool
    {
        return (bool) config('operations.stock_reservation.enabled', false);
    }

    /**
     * @return array{ok: bool, reservation?: StockReservation, available_after?: int, reason?: string}
     */
    public function hold(
        ProductVariant $variant,
        int $quantity,
        ?int $holdMinutes = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
    ): array {
        if (! $this->enabled()) {
            return ['ok' => true, 'reason' => 'disabled'];
        }

        if ($quantity <= 0) {
            return ['ok' => false, 'reason' => 'quantity_invalid'];
        }

        $available = $this->availableStock($variant);
        if ($available < $quantity) {
            return ['ok' => false, 'reason' => 'insufficient_stock', 'available_after' => $available];
        }

        $minutes = $holdMinutes ?? $this->holdMinutes;

        $res = StockReservation::create([
            'product_variant_id' => $variant->id,
            'quantity' => $quantity,
            'status' => 'held',
            'expires_at' => now()->addMinutes($minutes),
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
        ]);

        return ['ok' => true, 'reservation' => $res, 'available_after' => $available - $quantity];
    }

    /** Stok yang benar-benar dapat dijual = stock - (held belum expired). */
    public function availableStock(ProductVariant $variant): int
    {
        $held = StockReservation::query()
            ->where('product_variant_id', $variant->id)
            ->where('status', 'held')
            ->where('expires_at', '>', now())
            ->sum('quantity');

        return max(0, (int) $variant->stock - (int) $held);
    }

    public function release(int $reservationId, ?string $reason = null): bool
    {
        $res = StockReservation::query()->find($reservationId);
        if (! $res || $res->status !== 'held') {
            return false;
        }

        $res->update([
            'status' => 'released',
            'released_at' => now(),
            'updated_at' => now(),
        ]);

        return true;
    }

    public function confirm(int $reservationId): bool
    {
        $res = StockReservation::query()->find($reservationId);
        if (! $res || $res->status !== 'held') {
            return false;
        }

        $res->update(['status' => 'confirmed', 'updated_at' => now()]);

        return true;
    }

    /** Rilis semua hold kedaluwarsa; dipanggil scheduler tiap 5 menit. */
    public function releaseExpired(?Carbon $now = null): int
    {
        $snapshot = $now ?? now();

        return StockReservation::query()
            ->where('status', 'held')
            ->where('expires_at', '<=', $snapshot)
            ->update([
                'status' => 'released',
                'released_at' => $snapshot,
                'updated_at' => $snapshot,
            ]);
    }
}