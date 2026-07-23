<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Store-wide COD settings on cms_pages.slug = checkout.
 *
 * content.cod = {
 *   enabled: bool,
 *   fee_type: percent|fixed,
 *   fee_value: number,
 *   max_order_amount: number|null  // 0/null = no limit
 * }
 */
class CodSettings
{
    public const PAGE_SLUG = 'checkout';

    public const DEFAULTS = [
        'enabled' => true,
        'fee_type' => 'percent',
        'fee_value' => 0,
        'max_order_amount' => null,
    ];

    /**
     * @return array{enabled: bool, fee_type: string, fee_value: float, max_order_amount: float|null}
     */
    public static function get(): array
    {
        $page = self::page();
        $stored = is_array($page?->content['cod'] ?? null) ? $page->content['cod'] : [];

        $feeType = ($stored['fee_type'] ?? self::DEFAULTS['fee_type']) === 'fixed' ? 'fixed' : 'percent';
        $max = $stored['max_order_amount'] ?? null;
        $maxOrder = $max === null || $max === '' ? null : max(0, (float) $max);

        return [
            'enabled' => (bool) ($stored['enabled'] ?? self::DEFAULTS['enabled']),
            'fee_type' => $feeType,
            'fee_value' => max(0, (float) ($stored['fee_value'] ?? self::DEFAULTS['fee_value'])),
            'max_order_amount' => $maxOrder,
        ];
    }

    public static function enabled(): bool
    {
        return self::get()['enabled'];
    }

    /**
     * @param  array{enabled?: bool, fee_type?: string, fee_value?: float|int|string, max_order_amount?: float|int|string|null}  $settings
     * @return array{enabled: bool, fee_type: string, fee_value: float, max_order_amount: float|null}
     */
    public static function update(array $settings, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $merged = array_merge(self::DEFAULTS, is_array($content['cod'] ?? null) ? $content['cod'] : []);

        if (array_key_exists('enabled', $settings)) {
            $merged['enabled'] = (bool) $settings['enabled'];
        }
        if (array_key_exists('fee_type', $settings)) {
            $merged['fee_type'] = $settings['fee_type'] === 'fixed' ? 'fixed' : 'percent';
        }
        if (array_key_exists('fee_value', $settings)) {
            $value = max(0, (float) $settings['fee_value']);
            if (($merged['fee_type'] ?? 'percent') === 'percent') {
                $value = min(100, $value);
            }
            $merged['fee_value'] = $value;
        }
        if (array_key_exists('max_order_amount', $settings)) {
            $max = $settings['max_order_amount'];
            $merged['max_order_amount'] = ($max === null || $max === '')
                ? null
                : max(0, (float) $max);
        }

        $content['cod'] = $merged;
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return self::get();
    }

    /**
     * Handling fee for a COD order. Base = goods subtotal after voucher.
     */
    public static function calculateFee(float $subtotalAfterVoucher): float
    {
        $settings = self::get();
        if (! $settings['enabled'] || $settings['fee_value'] <= 0) {
            return 0.0;
        }

        $base = max(0, $subtotalAfterVoucher);
        if ($settings['fee_type'] === 'fixed') {
            return round((float) $settings['fee_value'], 2);
        }

        $percent = max(0, min(100, (float) $settings['fee_value']));

        return round($base * ($percent / 100), 2);
    }

    public static function assertAllowedForSubtotal(float $subtotalAfterVoucher): void
    {
        $settings = self::get();
        if (! $settings['enabled']) {
            throw new \DomainException('Layanan COD sedang tidak tersedia.');
        }

        $max = $settings['max_order_amount'];
        if ($max !== null && $max > 0 && $subtotalAfterVoucher > $max) {
            $label = number_format($max, 0, ',', '.');
            throw new \DomainException("COD hanya untuk belanja maksimal Rp {$label}.");
        }
    }

    /**
     * Preserve reserved cod settings when CMS editor updates checkout page.
     *
     * @param  array<string, mixed>|null  $incoming
     * @return array<string, mixed>
     */
    public static function mergePreserving(?array $incoming, ?CmsPage $page): array
    {
        $content = is_array($incoming) ? $incoming : [];
        if (($page?->slug ?? null) !== self::PAGE_SLUG) {
            return $content;
        }

        $existing = is_array($page?->content['cod'] ?? null) ? $page->content['cod'] : null;
        if ($existing !== null && ! array_key_exists('cod', $content)) {
            $content['cod'] = $existing;
        }

        return $content;
    }

    private static function page(bool $create = false): ?CmsPage
    {
        $page = CmsPage::query()->where('slug', self::PAGE_SLUG)->first();
        if ($page || ! $create) {
            return $page;
        }

        return CmsPage::create([
            'slug' => self::PAGE_SLUG,
            'title' => 'Checkout',
            'content' => [
                'cod' => self::DEFAULTS,
                'shipping_subsidy' => \App\Support\ShippingSubsidySettings::DEFAULTS,
            ],
            'published' => true,
        ]);
    }
}
