<?php

namespace App\Services;

use App\Models\StoreVoucher;
use Illuminate\Support\Str;

class VoucherService
{
    public const SESSION_KEY = 'checkout_voucher';

    /**
     * Backward-compatible entry point: voucher general atas satu agregat subtotal.
     *
     * @param  list<string>  $codes
     * @return array{code: string, codes: list<string>, name: string, discount: float, vouchers: list<array<string, mixed>>}
     */
    public function applyCodes(array $codes, float $effectiveSubtotal): array
    {
        return $this->applyCodesToLines($codes, [[
            'product_id' => null,
            'product_model' => null,
            'amount' => (float) $effectiveSubtotal,
        ]]);
    }

    /**
     * Apply kode voucher atas baris keranjang (harga efektif per baris).
     *
     * Target voucher (keputusan owner 2026-08-20):
     * - general  -> seluruh keranjang (perilaku lama);
     * - model    -> hanya baris dengan product_model = target_model;
     * - product  -> hanya baris dengan product_id = target_product_id.
     * Minimum pembelian dihitung dari SUBTOTAL BARIS YANG MEMENUHI TARGET saja.
     * Stacking tetap berurutan: base voucher berikutnya = sisa baris yang memenuhi
     * targetnya setelah potongan voucher sebelumnya (didistribusi proporsional).
     *
     * @param  list<string>  $codes
     * @param  list<array{product_id?: int|null, product_model?: string|null, amount: float}>  $lines
     * @return array{code: string, codes: list<string>, name: string, discount: float, vouchers: list<array<string, mixed>>}
     */
    public function applyCodesToLines(array $codes, array $lines): array
    {
        $codes = $this->normalizeCodes($codes);
        if ($codes === []) {
            throw new \DomainException('Masukkan kode voucher terlebih dahulu.');
        }

        $vouchers = [];
        foreach ($codes as $code) {
            $vouchers[] = $this->resolveForLines($code, $lines);
        }

        if (count($vouchers) > 1 && collect($vouchers)->contains(fn (StoreVoucher $voucher): bool => ! $voucher->stackable)) {
            throw new \DomainException('Voucher ini tidak dapat digabung dengan voucher lain.');
        }

        // Sisa nilai per baris; setiap voucher memotong baris yang memenuhi targetnya
        // secara proporsional sehingga voucher berikutnya menghitung dari sisa yang adil.
        $remaining = collect($lines)
            ->map(fn (array $line): float => max(0, (float) ($line['amount'] ?? 0)))
            ->values()
            ->all();

        $discountTotal = 0.0;
        $payload = [];

        foreach ($vouchers as $voucher) {
            $base = $this->eligibleRemainingBase($voucher, $lines, $remaining);
            $discount = $this->calculateDiscount($voucher, $base);

            if ($discount > 0 && $base > 0) {
                $this->distributeDiscount($voucher, $lines, $remaining, $discount, $base);
            }

            $discountTotal += $discount;
            $payload[] = [
                'voucher_id' => $voucher->id,
                'code' => $voucher->code,
                'name' => $voucher->name,
                'discount' => $discount,
                'stackable' => (bool) $voucher->stackable,
                'target_type' => $voucher->target_type ?? StoreVoucher::TARGET_GENERAL,
                'target_label' => $voucher->targetLabel(),
                'discount_percent' => $voucher->discount_type === 'percent' ? (float) $voucher->discount_value : null,
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

    /**
     * Validasi voucher terhadap baris keranjang: keberadaan, status, periode,
     * kesesuaian target (harus ada baris yang memenuhi), dan minimum belanja
     * atas subtotal baris yang memenuhi target.
     *
     * @param  list<array{product_id?: int|null, product_model?: string|null, amount: float}>  $lines
     */
    public function resolveForLines(string $rawCode, array $lines): StoreVoucher
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

        $eligibleBase = $this->eligibleBase($voucher, $lines);
        if (! $voucher->isGeneral() && $eligibleBase <= 0) {
            throw new \DomainException('Voucher ini hanya berlaku untuk '.$voucher->targetLabel().' — tidak ada produk yang memenuhi di keranjang Anda.');
        }
        if ($eligibleBase < (float) $voucher->min_purchase) {
            $min = number_format((float) $voucher->min_purchase, 0, ',', '.');
            throw new \DomainException("Minimum belanja untuk voucher ini Rp {$min}.");
        }

        return $voucher;
    }

    /**
     * Backward-compatible single resolve (agregat satu baris = subtotal).
     */
    public function resolveUsable(string $rawCode, float $effectiveSubtotal): StoreVoucher
    {
        return $this->resolveForLines($rawCode, [['amount' => (float) $effectiveSubtotal]]);
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

    /**
     * Subtotal saat ini (setelah potongan voucher sebelumnya) dari baris yang
     * memenuhi target voucher.
     *
     * @param  list<array<string, mixed>>  $lines
     * @param  list<float>  $remaining
     */
    private function eligibleRemainingBase(StoreVoucher $voucher, array $lines, array $remaining): float
    {
        $total = 0.0;
        foreach ($lines as $index => $line) {
            if ($this->lineMatches($voucher, $line)) {
                $total += max(0, (float) ($remaining[$index] ?? 0));
            }
        }

        return round($total, 2);
    }

    /**
     * Subtotal asli (sebelum potongan voucher apa pun) dari baris yang memenuhi target.
     *
     * @param  list<array<string, mixed>>  $lines
     */
    private function eligibleBase(StoreVoucher $voucher, array $lines): float
    {
        $total = 0.0;
        foreach ($lines as $line) {
            if ($this->lineMatches($voucher, $line)) {
                $total += max(0, (float) ($line['amount'] ?? 0));
            }
        }

        return round($total, 2);
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     */
    private function lineMatches(StoreVoucher $voucher, array $line): bool
    {
        if ($voucher->isGeneral()) {
            return true;
        }
        if ($voucher->target_type === StoreVoucher::TARGET_MODEL) {
            $lineModel = $line['product_model'] ?? null;

            return $lineModel !== null
                && Str::upper((string) $lineModel) === Str::upper((string) $voucher->target_model);
        }
        if ($voucher->target_type === StoreVoucher::TARGET_PRODUCT) {
            return isset($line['product_id'])
                && (int) $line['product_id'] === (int) $voucher->target_product_id;
        }

        return false;
    }

    /**
     * Distribusikan potongan secara proporsional ke baris yang memenuhi target
     * (baris terakhir menyerap sisa pembulatan agar total konsisten).
     *
     * @param  list<array<string, mixed>>  $lines
     * @param  list<float>  $remaining
     */
    private function distributeDiscount(StoreVoucher $voucher, array $lines, array &$remaining, float $discount, float $base): void
    {
        $indices = [];
        foreach ($lines as $index => $line) {
            if ($this->lineMatches($voucher, $line) && ($remaining[$index] ?? 0) > 0) {
                $indices[] = $index;
            }
        }

        $allocated = 0.0;
        $last = array_key_last($indices);
        foreach ($indices as $position => $index) {
            if ($position === $last) {
                $share = round($discount - $allocated, 2);
            } else {
                $share = round($discount * ((float) $remaining[$index] / $base), 2);
            }
            $remaining[$index] = max(0, round((float) $remaining[$index] - $share, 2));
            $allocated += $share;
        }
    }
}
