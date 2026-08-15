<?php

namespace App\Services;

use App\Models\StoreVoucher;
use Illuminate\Support\Str;

class VoucherService
{
    public const SESSION_KEY = 'checkout_voucher';

    /**
     * @param  list<string>  $codes
     * @return array{code: string, codes: list<string>, name: string, discount: float, vouchers: list<array<string, mixed>>}
     */
    public function applyCodes(array $codes, float $effectiveSubtotal): array
    {
        $codes = $this->normalizeCodes($codes);
        if ($codes === []) {
            throw new \DomainException('Masukkan kode voucher terlebih dahulu.');
        }

        $vouchers = [];
        foreach ($codes as $code) {
            $voucher = $this->resolveUsable($code, $effectiveSubtotal);
            $vouchers[] = $voucher;
        }

        if (count($vouchers) > 1 && collect($vouchers)->contains(fn (StoreVoucher $voucher): bool => ! $voucher->stackable)) {
            throw new \DomainException('Voucher ini tidak dapat digabung dengan voucher lain.');
        }

        $remaining = max(0, $effectiveSubtotal);
        $discountTotal = 0.0;
        $payload = [];

        foreach ($vouchers as $voucher) {
            $discount = $this->calculateDiscount($voucher, $remaining);
            $remaining = max(0, $remaining - $discount);
            $discountTotal += $discount;
            $payload[] = [
                'voucher_id' => $voucher->id,
                'code' => $voucher->code,
                'name' => $voucher->name,
                'discount' => $discount,
                'stackable' => (bool) $voucher->stackable,
            ];
        }

        return [
            'voucher_id' => $payload[0]['voucher_id'],
            'code' => implode(',', $codes),
            'codes' => $codes,
            'name' => implode(' + ', array_column($payload, 'name')),
            'discount' => round($discountTotal, 2),
            'vouchers' => $payload,
        ];
    }

    /**
     * Backward-compatible single-code entry point for existing callers/tests.
     *
     * @return array{code: string, codes: list<string>, name: string, discount: float, vouchers: list<array<string, mixed>>}
     */
    public function applyCode(string $rawCode, float $effectiveSubtotal): array
    {
        return $this->applyCodes([$rawCode], $effectiveSubtotal);
    }

    /**
     * @return list<string>
     */
    public function codesFromPayload(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $codes = $payload['codes'] ?? null;
        if (! is_array($codes)) {
            $codes = isset($payload['code']) ? preg_split('/\s*,\s*/', (string) $payload['code']) : [];
        }

        return $this->normalizeCodes(is_array($codes) ? $codes : []);
    }

    /**
     * @param  list<string>  $codes
     * @return list<string>
     */
    public function normalizeCodes(array $codes): array
    {
        return collect($codes)
            ->map(fn ($code): string => Str::upper(trim((string) $code)))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function resolveUsable(string $rawCode, float $effectiveSubtotal): StoreVoucher
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
        if ($effectiveSubtotal < (float) $voucher->min_purchase) {
            $min = number_format((float) $voucher->min_purchase, 0, ',', '.');
            throw new \DomainException("Minimum belanja untuk voucher ini Rp {$min}.");
        }

        return $voucher;
    }

    public function calculateDiscount(StoreVoucher $voucher, float $baseAmount): float
    {
        $baseAmount = max(0, $baseAmount);
        if ($voucher->discount_type === 'fixed') {
            return round(min((float) $voucher->discount_value, $baseAmount), 2);
        }

        $percent = max(0, min(100, (float) $voucher->discount_value));

        return round($baseAmount * ($percent / 100), 2);
    }

    /**
     * Multiple vouchers may be active. Stacking is decided per voucher at checkout.
     */
    public function publishExclusive(StoreVoucher $voucher): void
    {
        $voucher->update(['published' => true]);
    }

    public function unpublish(StoreVoucher $voucher): void
    {
        $voucher->update(['published' => false]);
    }
}
