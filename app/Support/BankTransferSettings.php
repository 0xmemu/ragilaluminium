<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Detail rekening bank transfer yang bisa diedit admin (owner 2026-09-16).
 *
 * Tersimpan di cms_pages.slug = checkout -> content.bank_transfer, mengikuti
 * pola CodSettings. Sumber lama (config sitemap.brand.bank / env) tetap jadi
 * fallback awal sehingga perilaku sebelumnya tidak berubah bila admin belum
 * pernah menyimpan.
 *
 * Dipakai oleh: instruksi transfer WA (WhatsAppService) + halaman konfirmasi
 * order storefront.
 */
class BankTransferSettings
{
    public const PAGE_SLUG = 'checkout';
    public const SETTING_KEY = 'bank_transfer';

    /**
     * @return array{bank_name: string, account_name: string, account_number: string, notes: string}|null
     */
    public static function get(): ?array
    {
        $page = CmsSettings::pageBySlug(self::PAGE_SLUG);
        $stored = is_array($page?->content[self::SETTING_KEY] ?? null)
            ? $page->content[self::SETTING_KEY]
            : [];

        // Fallback ke config/env (sumber lama) bila admin belum pernah simpan.
        $fallback = BankTransferInstructions::fromConfig();

        $merged = [
            'bank_name' => trim((string) ($stored['bank_name'] ?? $fallback['bank_name'] ?? '')),
            'account_name' => trim((string) ($stored['account_name'] ?? $fallback['account_name'] ?? '')),
            'account_number' => trim((string) ($stored['account_number'] ?? $fallback['account_number'] ?? '')),
            'notes' => trim((string) ($stored['notes'] ?? $fallback['notes'] ?? '')),
        ];

        if ($merged['bank_name'] === '' || $merged['account_name'] === '' || $merged['account_number'] === '') {
            return null;
        }

        return $merged;
    }

    /**
     * @param array{bank_name?: string, account_name?: string, account_number?: string, notes?: string} $values
     * @return array{bank_name: string, account_name: string, account_number: string, notes: string}|null
     */
    public static function update(array $values, ?int $adminId = null): ?array
    {
        $page = CmsSettings::pageBySlug(self::PAGE_SLUG);

        if (! $page) {
            $page = CmsPage::create([
                'slug' => self::PAGE_SLUG,
                'title' => 'Checkout',
                'content' => [self::SETTING_KEY => []],
                'published' => true,
            ]);
        }

        $content = is_array($page->content) ? $page->content : [];
        $existing = is_array($content[self::SETTING_KEY] ?? null) ? $content[self::SETTING_KEY] : [];

        $merged = array_merge($existing, [
            'bank_name' => trim((string) ($values['bank_name'] ?? $existing['bank_name'] ?? '')),
            'account_name' => trim((string) ($values['account_name'] ?? $existing['account_name'] ?? '')),
            'account_number' => trim((string) ($values['account_number'] ?? $existing['account_number'] ?? '')),
            'notes' => trim((string) ($values['notes'] ?? $existing['notes'] ?? '')),
        ]);

        $content[self::SETTING_KEY] = $merged;
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return self::get();
    }
}
