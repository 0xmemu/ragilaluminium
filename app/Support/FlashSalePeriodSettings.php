<?php

namespace App\Support;

use App\Models\CmsPage;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Global Flash Sale campaign window on cms_pages.slug = flash-sale.
 *
 * content.period = {
 *   enabled: bool,
 *   starts_at: datetime string|null,
 *   ends_at: datetime string|null
 * }
 *
 * Produk tetap ditandai via product_attributes.promo_flash_sale;
 * periode ini menentukan apakah Flash Sale "live" di storefront.
 */
class FlashSalePeriodSettings
{
    public const PAGE_SLUG = 'flash-sale';

    public const DEFAULTS = [
        'enabled' => false,
        'starts_at' => null,
        'ends_at' => null,
    ];

    /**
     * @return array{enabled: bool, starts_at: string|null, ends_at: string|null}
     */
    public static function get(): array
    {
        $campaignPeriod = app(\App\Services\CampaignService::class)->flashPeriod();
        if ($campaignPeriod !== null) {
            return $campaignPeriod;
        }

        $page = self::page();
        $stored = is_array($page?->content['period'] ?? null)
            ? $page->content['period']
            : [];

        return [
            'enabled' => (bool) ($stored['enabled'] ?? self::DEFAULTS['enabled']),
            'starts_at' => self::normalizeDateTime($stored['starts_at'] ?? null),
            'ends_at' => self::normalizeDateTime($stored['ends_at'] ?? null),
        ];
    }

    public static function isLive(?Carbon $now = null): bool
    {
        $period = self::get();
        if (! $period['enabled']) {
            return false;
        }

        $now ??= Carbon::now();
        $starts = self::parse($period['starts_at']);
        $ends = self::parse($period['ends_at']);

        if ($starts && $now->lt($starts)) {
            return false;
        }
        if ($ends && $now->gt($ends)) {
            return false;
        }

        return true;
    }

    /**
     * Payload for Inertia (admin + public).
     *
     * @return array{
     *     enabled: bool,
     *     live: bool,
     *     status: 'disabled'|'scheduled'|'live'|'ended',
     *     starts_at: string|null,
     *     ends_at: string|null,
     *     starts_at_label: string|null,
     *     ends_at_label: string|null,
     *     range_label: string|null,
     *     seconds_remaining: int|null,
     *     daily_seconds_remaining: int|null,
     *     daily_ends_at: string|null,
     *     update_url?: string
     * }
     */
    public static function publicState(?Carbon $now = null): array
    {
        $period = self::get();
        $now ??= Carbon::now();
        $starts = self::parse($period['starts_at']);
        $ends = self::parse($period['ends_at']);

        $status = 'disabled';
        if ($period['enabled']) {
            if ($starts && $now->lt($starts)) {
                $status = 'scheduled';
            } elseif ($ends && $now->gt($ends)) {
                $status = 'ended';
            } else {
                $status = 'live';
            }
        }

        $secondsRemaining = null;
        if ($status === 'live' && $ends) {
            $secondsRemaining = max(0, $ends->getTimestamp() - $now->getTimestamp());
        } elseif ($status === 'scheduled' && $starts) {
            $secondsRemaining = max(0, $starts->getTimestamp() - $now->getTimestamp());
        }

        $dailyDeadline = $status === 'live' ? self::dailyDeadline($now, $ends) : null;
        $dailySecondsRemaining = $dailyDeadline !== null
            ? max(0, $dailyDeadline->getTimestamp() - $now->getTimestamp())
            : null;

        return [
            'enabled' => $period['enabled'],
            'live' => $status === 'live',
            'status' => $status,
            'starts_at' => $period['starts_at'],
            'ends_at' => $period['ends_at'],
            'starts_at_label' => self::formatLabel($starts),
            'ends_at_label' => self::formatLabel($ends),
            'range_label' => self::rangeLabel($starts, $ends),
            'seconds_remaining' => $secondsRemaining,
            'daily_seconds_remaining' => $dailySecondsRemaining,
            'daily_ends_at' => $dailyDeadline?->toIso8601String(),
        ];
    }

    /**
     * @param  array{enabled?: bool, starts_at?: string|null, ends_at?: string|null}  $settings
     * @return array{enabled: bool, starts_at: string|null, ends_at: string|null}
     */
    public static function update(array $settings, ?int $adminId = null): array
    {
        $page = self::page(create: true);
        $content = is_array($page->content) ? $page->content : [];
        $merged = array_merge(
            self::DEFAULTS,
            is_array($content['period'] ?? null) ? $content['period'] : []
        );

        if (array_key_exists('enabled', $settings)) {
            $merged['enabled'] = (bool) $settings['enabled'];
        }
        if (array_key_exists('starts_at', $settings)) {
            $merged['starts_at'] = self::normalizeDateTime($settings['starts_at']);
        }
        if (array_key_exists('ends_at', $settings)) {
            $merged['ends_at'] = self::normalizeDateTime($settings['ends_at']);
        }

        $starts = self::parse($merged['starts_at'] ?? null);
        $ends = self::parse($merged['ends_at'] ?? null);
        if ($starts && $ends && $ends->lte($starts)) {
            throw ValidationException::withMessages([
                'ends_at' => 'Waktu selesai harus setelah waktu mulai.',
            ]);
        }

        $content['period'] = [
            'enabled' => (bool) $merged['enabled'],
            'starts_at' => $merged['starts_at'],
            'ends_at' => $merged['ends_at'],
        ];
        $page->content = $content;
        $page->published = true;
        $page->title = $page->title ?: 'Flash Sale';
        if ($adminId) {
            $page->updated_by_admin_id = $adminId;
        }
        $page->save();

        return self::get();
    }

    private static function normalizeDateTime(mixed $value): ?string
    {
        if (! filled($value)) {
            return null;
        }

        try {
            return Carbon::parse((string) $value)->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }

    private static function parse(?string $value): ?Carbon
    {
        if (! filled($value)) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private static function formatLabel(?Carbon $dt): ?string
    {
        if (! $dt) {
            return null;
        }

        return $dt->timezone(config('app.timezone'))->translatedFormat('d M Y, H.i').' WIB';
    }

    /** End of current app day, or campaign end when sooner. */
    private static function dailyDeadline(Carbon $now, ?Carbon $ends): Carbon
    {
        $endOfDay = $now->copy()->timezone(config('app.timezone'))->endOfDay();

        if ($ends !== null && $ends->lt($endOfDay)) {
            return $ends;
        }

        return $endOfDay;
    }

    private static function rangeLabel(?Carbon $starts, ?Carbon $ends): ?string
    {
        if ($starts && $ends) {
            return self::formatLabel($starts).' s/d '.self::formatLabel($ends);
        }
        if ($starts) {
            return 'Mulai '.self::formatLabel($starts);
        }
        if ($ends) {
            return 'Berakhir '.self::formatLabel($ends);
        }

        return null;
    }

    private static function page(bool $create = false): ?CmsPage
    {
        $page = CmsPage::query()->where('slug', self::PAGE_SLUG)->first();
        if ($page || ! $create) {
            return $page;
        }

        return CmsPage::create([
            'slug' => self::PAGE_SLUG,
            'title' => 'Flash Sale',
            'content' => [
                'period' => self::DEFAULTS,
            ],
            'published' => true,
        ]);
    }
}
