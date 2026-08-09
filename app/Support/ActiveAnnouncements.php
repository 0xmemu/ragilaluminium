<?php

namespace App\Support;

use App\Models\Announcement;
use App\Models\CmsBanner;
use Carbon\Carbon;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

/**
 * Announcement ticker: promo/diskon berbasis waktu + satu Flash Sale kampanye (periode live).
 *
 * Flash Sale di ticker = event jangka waktu (cms_pages.flash-sale.content.period),
 * bukan daftar produk. Produk Flash Sale dipilih pelanggan di /flash-sale atau hasil cari.
 *
 * Copy: jangan pakai "obral" / "stok terbatas" — stok selalu ada;
 * yang boleh limited-time hanya promo, diskon, flash sale (periode), subsidi ongkir.
 */
class ActiveAnnouncements
{
    private const MAX_TICKER_CHARACTERS = 64;
    private const BANNED_PATTERN = '/\b(obral|stok\s+terbatas|kuota\s+habis|stok\s+menipis)\b/iu';

    /** Ticker umum tidak boleh teriak Flash Sale berulang; satu slot periode saja. */
    private const FLASH_SHOUT_PATTERN = '/flash\s*sale/iu';

    /**
     * @return list<array{text: string, href: string}>
     */
    public static function items(): array
    {
        $cfg = config('sitemap.announcement', []);
        if (! ($cfg['enabled'] ?? false)) {
            return [];
        }

        // Bar promo yang dikelola admin (dashboard) lebih diutamakan.
        // Begitu tabel pernah terisi, hasil DB otoritatif: item yang tidak aktif
        // atau periode berakhir berarti bar tidak menampilkan apa pun (tidak
        // kembali ke sumber lama) — "nonaktifkan semua" benar-benar menyembunyikan bar.
        if (Announcement::query()->exists()) {
            return self::fromAdminAnnouncements();
        }

        $now = Carbon::now();
        $out = [];

        foreach ($cfg['items'] ?? [] as $raw) {
            $item = self::normalize($raw, $now);
            if ($item !== null) {
                $out[] = $item;
            }
        }

        if (($cfg['include_cms_banners'] ?? false) === true) {
            try {
                foreach (CmsBanner::published()->get() as $banner) {
                    $title = trim((string) $banner->title);
                    $href = trim((string) ($banner->link_url ?? ''));
                    if ($title === '' || $href === '' || self::isBannedCopy($title) || self::isFlashShout($title)) {
                        continue;
                    }
                    $out[] = [
                        'text' => $title,
                        'href' => $href,
                    ];
                }
            } catch (\Throwable) {
                // CMS table may be empty / unavailable in some environments.
            }
        }

        if (($cfg['include_homepage_promos'] ?? false) === true) {
            foreach (self::fromHomepagePromos() as $item) {
                $out[] = $item;
            }
        }

        // Satu pengumuman Flash Sale berbasis periode kampanye (bukan produk).
        foreach (self::fromFlashSalePeriod() as $item) {
            array_unshift($out, $item);
        }

        return self::uniqueByText(array_values($out));
    }

    /**
     * Item bar promo dari tabel `announcements` (dikelola di dashboard admin).
     * Urutan tampil = urutan `sort_order`; hanya item aktif + dalam periode.
     *
     * @return list<array{text: string, href: string}>
     */
    private static function fromAdminAnnouncements(): array
    {
        try {
            $rows = Announcement::query()
                ->published()
                ->active()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();
        } catch (\Throwable) {
            // Tabel belum tersedia di sebagian environment.
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            $text = self::limitTickerText((string) $row->text);
            if ($text === '' || self::isBannedCopy($text)) {
                continue;
            }
            $href = trim((string) $row->href);
            $out[] = [
                'text' => $text,
                'href' => $href !== '' ? $href : route('catalog.index'),
            ];
        }

        return $out;
    }

    /**
     * @return list<array{text: string, href: string}>
     */
    private static function fromFlashSalePeriod(): array
    {
        try {
            $period = FlashSalePeriodSettings::publicState();
        } catch (\Throwable) {
            return [];
        }

        if (! $period['live']) {
            return [];
        }

        $text = 'Flash Sale sedang berlangsung';
        if (filled($period['ends_at_label'])) {
            $text .= '. Berakhir '.$period['ends_at_label'];
        } elseif (filled($period['range_label'])) {
            $text .= '. '.$period['range_label'];
        }

        if (self::isBannedCopy($text)) {
            return [];
        }

        $href = Route::has('catalog.flash-sale')
            ? route('catalog.flash-sale')
            : '/flash-sale';

        return [[
            'text' => $text,
            'href' => $href,
        ]];
    }

    /**
     * @return list<array{text: string, href: string}>
     */
    private static function fromHomepagePromos(): array
    {
        try {
            $slides = HomepagePromotions::slides();
        } catch (\Throwable) {
            return [];
        }

        $out = [];
        foreach ($slides as $slide) {
            // Hero landing + automatic product slides stay off the ticker.
            if (($slide['source'] ?? null) === 'automatic') {
                continue;
            }
            if (($slide['layout'] ?? null) === 'landing') {
                continue;
            }

            $text = self::formatPromoTickerCopy($slide);
            $href = trim((string) ($slide['href'] ?? ''));
            if ($text === '' || $href === '' || self::isBannedCopy($text) || self::isFlashShout($text)) {
                continue;
            }
            $out[] = [
                'text' => $text,
                'href' => $href,
            ];
        }

        return $out;
    }

    /**
     * Model-first ticker line — sentence case, no ALL CAPS dump / Flash Sale shout.
     *
     * @param  array<string, mixed>  $slide
     */
    private static function formatPromoTickerCopy(array $slide): string
    {
        $headline = trim(preg_replace(
            '/\s+/u',
            ' ',
            str_replace(["\n", "\r"], ' ', (string) ($slide['headline'] ?? '')),
        ) ?? '');
        $accent = trim((string) ($slide['accent'] ?? ''));
        $eyebrow = trim((string) ($slide['eyebrow'] ?? ''));

        // Prefer "Promo Diskon" framing even if slide still carries flash metadata.
        if ($eyebrow === '' || Str::contains(Str::lower($eyebrow), 'flash')) {
            $eyebrow = $accent !== '' ? 'Promo Diskon' : 'Promo';
        }

        if ($headline === '') {
            return $eyebrow;
        }

        if ($accent !== '') {
            return "{$eyebrow}: {$headline} {$accent}. Belanja model ini.";
        }

        return "{$eyebrow}: {$headline}. Cek harga spesial.";
    }

    /**
     * @param  string|array<string, mixed>  $raw
     * @return array{text: string, href: string}|null
     */
    private static function normalize(string|array $raw, Carbon $now): ?array
    {
        if (is_string($raw)) {
            $text = trim($raw);
            if ($text === '' || self::isBannedCopy($text) || self::isFlashShout($text)) {
                return null;
            }

            return [
                'text' => $text,
                'href' => route('catalog.index'),
            ];
        }

        $text = trim((string) ($raw['text'] ?? ''));
        if ($text === '' || self::isBannedCopy($text) || self::isFlashShout($text)) {
            return null;
        }

        $starts = self::parseDate($raw['starts_at'] ?? null);
        $ends = self::parseDate($raw['ends_at'] ?? null, endOfDay: true);

        if ($starts && $now->lt($starts)) {
            return null;
        }
        if ($ends && $now->gt($ends)) {
            return null;
        }

        $href = self::resolveHref($raw);
        if ($href === null || $href === '') {
            return null;
        }

        return [
            'text' => $text,
            'href' => $href,
        ];
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    private static function resolveHref(array $raw): ?string
    {
        if (filled($raw['href'] ?? null)) {
            return (string) $raw['href'];
        }

        $routeName = $raw['route'] ?? null;
        if (! is_string($routeName) || $routeName === '' || ! Route::has($routeName)) {
            return route('catalog.index');
        }

        $params = is_array($raw['params'] ?? null) ? $raw['params'] : [];
        [$routeName, $params] = PublicNavigation::canonicalRoute($routeName, $params);

        return route($routeName, $params);
    }

    private static function parseDate(mixed $value, bool $endOfDay = false): ?Carbon
    {
        if (! filled($value)) {
            return null;
        }

        try {
            $dt = Carbon::parse((string) $value);

            return $endOfDay ? $dt->endOfDay() : $dt->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    private static function isBannedCopy(string $text): bool
    {
        return (bool) preg_match(self::BANNED_PATTERN, $text);
    }

    private static function isFlashShout(string $text): bool
    {
        return (bool) preg_match(self::FLASH_SHOUT_PATTERN, $text);
    }

    private static function limitTickerText(string $text): string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

        return Str::limit($normalized, self::MAX_TICKER_CHARACTERS, '...');
    }

    /**
     * @param  list<array{text: string, href: string}>  $items
     * @return list<array{text: string, href: string}>
     */
    private static function uniqueByText(array $items): array
    {
        $seen = [];
        $out = [];
        foreach ($items as $item) {
            $text = self::limitTickerText((string) ($item['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $key = Str::lower($text);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = [...$item, 'text' => $text];
        }

        return $out;
    }
}
