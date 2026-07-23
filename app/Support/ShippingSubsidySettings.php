<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Store-wide shipping subsidy on cms_pages.slug = checkout.
 *
 * content.shipping_subsidy = {
 *   enabled: bool,
 *   subsidy_type: percent|fixed,
 *   subsidy_value: number,
 *   carriers: { jnt: bool }
 * }
 */
class ShippingSubsidySettings
{
    public const PAGE_SLUG = 'checkout';

    public const DEFAULTS = [
        'enabled' => false,
        'subsidy_type' => 'percent',
        'subsidy_value' => 0,
        'carriers' => [
            'jnt' => true,
        ],
    ];

    /**
     * @return array{enabled: bool, subsidy_type: string, subsidy_value: float, carriers: array{jnt: bool}}
     */
    public static function get(): array
    {
        $page = self::page();
        $stored = is_array($page?->content['shipping_subsidy'] ?? null)
            ? $page->content['shipping_subsidy']
            : [];

        $type = ($stored['subsidy_type'] ?? self::DEFAULTS['subsidy_type']) === 'fixed'
            ? 'fixed'
            : 'percent';
        $carriers = is_array($stored['carriers'] ?? null) ? $stored['carriers'] : [];

        return [
            'enabled' => (bool) ($stored['enabled'] ?? self::DEFAULTS['enabled']),
            'subsidy_type' => $type,
            'subsidy_value' => max(0, (float) ($stored['subsidy_value'] ?? self::DEFAULTS['subsidy_value'])),
            'carriers' => [
                'jnt' => (bool) ($carriers['jnt'] ?? self::DEFAULTS['carriers']['jnt']),
            ],
        ];
    }

    public static function enabled(): bool
    {
        return self::get()['enabled'];
    }

    /**
     * @param  array{enabled?: bool, subsidy_type?: string, subsidy_value?: float|int|string, jnt_enabled?: bool}  $settings
     * @return array{enabled: bool, subsidy_type: string, subsidy_value: float, carriers: array{jnt: bool}}
     */
    public static function update(array $settings, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $merged = array_merge(
            self::DEFAULTS,
            is_array($content['shipping_subsidy'] ?? null) ? $content['shipping_subsidy'] : []
        );
        $merged['carriers'] = array_merge(
            self::DEFAULTS['carriers'],
            is_array($merged['carriers'] ?? null) ? $merged['carriers'] : []
        );

        if (array_key_exists('enabled', $settings)) {
            $merged['enabled'] = (bool) $settings['enabled'];
        }
        if (array_key_exists('subsidy_type', $settings)) {
            $merged['subsidy_type'] = $settings['subsidy_type'] === 'fixed' ? 'fixed' : 'percent';
        }
        if (array_key_exists('subsidy_value', $settings)) {
            $value = max(0, (float) $settings['subsidy_value']);
            if (($merged['subsidy_type'] ?? 'percent') === 'percent') {
                $value = min(100, $value);
            }
            $merged['subsidy_value'] = $value;
        }
        if (array_key_exists('jnt_enabled', $settings)) {
            $merged['carriers']['jnt'] = (bool) $settings['jnt_enabled'];
        }

        $content['shipping_subsidy'] = $merged;
        // Preserve sibling checkout keys (cod, etc.).
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return self::get();
    }

    /**
     * @return array{gross: float, subsidy: float, net: float, applied: bool}
     */
    public static function apply(float $grossShipping, string $carrier = 'jnt'): array
    {
        $gross = max(0, round($grossShipping, 2));
        $settings = self::get();
        $carrierOk = (bool) ($settings['carriers'][$carrier] ?? false);

        if (! $settings['enabled'] || ! $carrierOk || $settings['subsidy_value'] <= 0 || $gross <= 0) {
            return [
                'gross' => $gross,
                'subsidy' => 0.0,
                'net' => $gross,
                'applied' => false,
            ];
        }

        if ($settings['subsidy_type'] === 'fixed') {
            $subsidy = min($gross, round((float) $settings['subsidy_value'], 2));
        } else {
            $percent = max(0, min(100, (float) $settings['subsidy_value']));
            $subsidy = round($gross * ($percent / 100), 2);
        }

        return [
            'gross' => $gross,
            'subsidy' => $subsidy,
            'net' => max(0, round($gross - $subsidy, 2)),
            'applied' => $subsidy > 0,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $incoming
     * @return array<string, mixed>
     */
    public static function mergePreserving(?array $incoming, ?CmsPage $page): array
    {
        $content = is_array($incoming) ? $incoming : [];
        if (($page?->slug ?? null) !== self::PAGE_SLUG) {
            return $content;
        }

        $existing = is_array($page?->content['shipping_subsidy'] ?? null)
            ? $page->content['shipping_subsidy']
            : null;
        if ($existing !== null && ! array_key_exists('shipping_subsidy', $content)) {
            $content['shipping_subsidy'] = $existing;
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
                'cod' => \App\Support\CodSettings::DEFAULTS,
                'shipping_subsidy' => self::DEFAULTS,
            ],
            'published' => true,
        ]);
    }
}
