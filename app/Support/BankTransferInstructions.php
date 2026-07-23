<?php

namespace App\Support;

/**
 * Bank transfer instructions for public checkout confirmation.
 * Source: config (sitemap.brand.bank / env) — no extra schema table.
 */
class BankTransferInstructions
{
    /**
     * @return array{
     *     bank_name: string,
     *     account_name: string,
     *     account_number: string,
     *     notes: string
     * }|null
     */
    public static function forStorefront(): ?array
    {
        $bank = config('sitemap.brand.bank', []);
        if (! is_array($bank)) {
            return null;
        }

        $name = trim((string) ($bank['bank_name'] ?? ''));
        $accountName = trim((string) ($bank['account_name'] ?? ''));
        $accountNumber = trim((string) ($bank['account_number'] ?? ''));

        if ($name === '' || $accountName === '' || $accountNumber === '') {
            return null;
        }

        return [
            'bank_name' => $name,
            'account_name' => $accountName,
            'account_number' => $accountNumber,
            'notes' => trim((string) ($bank['notes'] ?? 'Transfer sesuai total tagihan, lalu kirim bukti via WhatsApp.')),
        ];
    }
}
