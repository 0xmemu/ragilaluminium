<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * Store-wide shipping subsidy on cms_pages.slug = checkout.
 */
class ShippingSubsidySettings
{
    public const PAGE_SLUG = 'checkout';
    public const SETTING_KEY = OperationalSettings::SHIPPING_SUBSIDY;

    public const DEFAULTS = [
        'enabled' => false,
        'subsidy_type' => 'percent',
        'subsidy_value' => 0,
        'carriers' => ['jnt' => true],
    ];

    /** @return array{enabled: bool, subsidy_type: string, subsidy_value: float, carriers: array{jnt: bool}} */
    public static function get(): array
    {
        $versioned = OperationalSettings::current(self::SETTING_KEY);

        return is_array($versioned)
            ? OperationalSettings::normalize(self::SETTING_KEY, $versioned)
            : self::readCms();
    }

    /** @return array{enabled: bool, subsidy_type: string, subsidy_value: float, carriers: array{jnt: bool}} */
    private static function readCms(): array
    {
        $page = self::page();
        $stored = is_array($page?->content['shipping_subsidy'] ?? null) ? $page->content['shipping_subsidy'] : [];
        $type = ($stored['subsidy_type'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent';
        $carriers = is_array($stored['carriers'] ?? null) ? $stored['carriers'] : [];

        return [
            'enabled' => (bool) ($stored['enabled'] ?? false),
            'subsidy_type' => $type,
            'subsidy_value' => $type === 'percent'
                ? min(100, max(0, (float) ($stored['subsidy_value'] ?? 0)))
                : max(0, (float) ($stored['subsidy_value'] ?? 0)),
            'carriers' => ['jnt' => (bool) ($carriers['jnt'] ?? true)],
        ];
    }

    /** @param array{source?: string, reason?: string|null, reference_type?: string|null, reference_id?: string|null} $audit */
    public static function update(array $settings, ?int $adminId = null, array $audit = []): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $merged = array_merge(self::DEFAULTS, is_array($content['shipping_subsidy'] ?? null) ? $content['shipping_subsidy'] : []);
        $merged['carriers'] = array_merge(self::DEFAULTS['carriers'], is_array($merged['carriers'] ?? null) ? $merged['carriers'] : []);

        if (array_key_exists('enabled', $settings)) {
            $merged['enabled'] = (bool) $settings['enabled'];
        }
        if (array_key_exists('subsidy_type', $settings)) {
            $merged['subsidy_type'] = $settings['subsidy_type'] === 'fixed' ? 'fixed' : 'percent';
        }
        if (array_key_exists('subsidy_value', $settings)) {
            $value = max(0, (float) $settings['subsidy_value']);
            $merged['subsidy_value'] = $merged['subsidy_type'] === 'percent' ? min(100, $value) : $value;
        }
        if (array_key_exists('jnt_enabled', $settings)) {
            $merged['carriers']['jnt'] = (bool) $settings['jnt_enabled'];
        }

        $content['shipping_subsidy'] = $merged;
        $page->content = $content;
        $page->published = true;
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        $after = self::readCms();
        if (OperationalSettings::available()) {
            OperationalSettings::record(
                self::SETTING_KEY,
                $after,
                $adminId,
            (string) ($audit['source'] ?? 'admin'),
            $audit['reason'] ?? null,
            $audit['reference_type'] ?? CmsPage::class,
            $audit['reference_id'] ?? (string) $page->id,
            );

        }
        return $after;
    }

    /** @return array{gross: float, subsidy: float, net: float, applied: bool} */
    public static function apply(float $grossShipping, string $carrier = 'jnt'): array
    {
        $gross = max(0, round($grossShipping, 2));
        $settings = self::get();
        $carrierOk = (bool) ($settings['carriers'][$carrier] ?? false);

        if (! $settings['enabled'] || ! $carrierOk || $settings['subsidy_value'] <= 0 || $gross <= 0) {
            return ['gross' => $gross, 'subsidy' => 0.0, 'net' => $gross, 'applied' => false];
        }

        $subsidy = $settings['subsidy_type'] === 'fixed'
            ? min($gross, round((float) $settings['subsidy_value'], 2))
            : round($gross * (min(100, max(0, (float) $settings['subsidy_value'])) / 100), 2);

        return [
            'gross' => $gross,
            'subsidy' => $subsidy,
            'net' => max(0, round($gross - $subsidy, 2)),
            'applied' => $subsidy > 0,
        ];
    }

    /** @param array<string, mixed>|null $incoming */
    public static function mergePreserving(?array $incoming, ?CmsPage $page): array
    {
        $content = is_array($incoming) ? $incoming : [];
        if (($page?->slug ?? null) !== self::PAGE_SLUG) {
            return $content;
        }

        $existing = is_array($page?->content['shipping_subsidy'] ?? null) ? $page->content['shipping_subsidy'] : null;
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
                'cod' => CodSettings::DEFAULTS,
                'shipping_subsidy' => self::DEFAULTS,
            ],
            'published' => true,
        ]);
    }
}
