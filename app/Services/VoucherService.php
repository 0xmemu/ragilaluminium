<?php

namespace App\Services;

use App\Models\StoreVoucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VoucherService
{
    public const SESSION_KEY = 'checkout_voucher';

    /**
     * @return array{code: string, name: string, discount: float, voucher_id: int}
     */
    public function applyCode(string $rawCode, float $subtotal): array
    {
        $voucher = $this->resolveUsable($rawCode, $subtotal);
        $discount = $this->calculateDiscount($voucher, $subtotal);

        return [
            'voucher_id' => $voucher->id,
            'code' => $voucher->code,
            'name' => $voucher->name,
            'discount' => $discount,
        ];
    }

    public function resolveUsable(string $rawCode, float $subtotal): StoreVoucher
    {
        $code = Str::upper(trim($rawCode));
        if ($code === '') {
            throw new \DomainException('Masukkan kode voucher terlebih dahulu.');
        }

        $voucher = StoreVoucher::query()->where('code', $code)->first();
        if (! $voucher) {
            throw new \DomainException('Kode voucher tidak ditemukan.');
        }
        if (! $voucher->published) {
            throw new \DomainException('Voucher tidak aktif.');
        }
        if (! $voucher->isWithinSchedule()) {
            throw new \DomainException('Voucher di luar periode berlaku.');
        }
        if ($subtotal < (float) $voucher->min_purchase) {
            $min = number_format((float) $voucher->min_purchase, 0, ',', '.');
            throw new \DomainException("Minimum belanja untuk voucher ini Rp {$min}.");
        }

        return $voucher;
    }

    public function calculateDiscount(StoreVoucher $voucher, float $subtotal): float
    {
        $subtotal = max(0, $subtotal);
        if ($voucher->discount_type === 'fixed') {
            return round(min((float) $voucher->discount_value, $subtotal), 2);
        }

        $percent = max(0, min(100, (float) $voucher->discount_value));

        return round($subtotal * ($percent / 100), 2);
    }

    /**
     * Figma rule: only one published voucher at a time.
     */
    public function publishExclusive(StoreVoucher $voucher): void
    {
        DB::transaction(function () use ($voucher) {
            StoreVoucher::query()
                ->where('id', '!=', $voucher->id)
                ->where('published', true)
                ->update(['published' => false]);

            $voucher->update(['published' => true]);
        });
    }

    public function unpublish(StoreVoucher $voucher): void
    {
        $voucher->update(['published' => false]);
    }
}
