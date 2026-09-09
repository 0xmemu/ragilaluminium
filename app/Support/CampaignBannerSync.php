<?php

namespace App\Support;

use App\Models\Promotion;
use Illuminate\Support\Facades\Cache;

/**
 * Resolve materi banner/bar yang disinkronkan dari kampanye (Promotion::sync_banner).
 *
 * Kontrak owner 2026-09-08:
 * - Ketika admin mengaktifkan "Tandai juga sebagai banner beranda" dan mengisi
 *   gambar + link, sistem menampilkan banner tersebut di carousel beranda
 *   HANYA selama kampanye live (status active, atau scheduled yang sudah mulai).
 * - Toggle "Bar promo" menampilkan satu baris bar promo beranda selama live.
 * - Saat kampanye berakhir (ended/finished), banner & bar otomatis tidak tampil
 *   lagi tanpa perlu admin membersihkan manual (materi tetap tersimpan).
 */
class CampaignBannerSync
{
    public const CACHE_KEY = 'campaign.sync_banner';
    public const BAR_CACHE_KEY = 'campaign.sync_bar';

    /** @return array|null{title: string, image_url: string, link_url: string} */
    public static function activeBanner(): ?array
    {
        return Cache::remember(self::CACHE_KEY, 120, function (): ?array {
            $campaign = self::liveCampaignWithBanner();
            if ($campaign === null) {
                return null;
            }

            $imageUrl = $campaign->mediaAsset?->urlFor('pdp')
                ?: $campaign->mediaAsset?->urlFor('card')
                ?: trim((string) $campaign->sync_banner_image_url);

            if ($imageUrl === '' || str_contains($imageUrl, 'pending/')) {
                $productIds = app(\App\Services\CampaignService::class)->resolveProductIds(collect($campaign->items));
                $firstProduct = \App\Models\Product::whereIn('id', $productIds)
                    ->whereHas('mainImage')
                    ->with('mainImage')
                    ->first();
                $imageUrl = $firstProduct?->mainImage?->urlFor('pdp')
                    ?: $firstProduct?->mainImage?->urlFor('card')
                    ?: '';
            }

            if ($imageUrl === '') {
                return null;
            }

            return [
                'title' => $campaign->name,
                'image_url' => $imageUrl,
                'link_url' => filled($campaign->sync_banner_link_url)
                    ? (string) $campaign->sync_banner_link_url
                    : ($campaign->isFlashSale() ? '/flash-sale' : '/promo'),
            ];
        });
    }

    /** @return array|null{text: string, href: string} */
    public static function activeBarPromo(): ?array
    {
        return Cache::remember(self::BAR_CACHE_KEY, 120, function (): ?array {
            $campaign = self::liveCampaignWithBanner();
            if ($campaign === null || ! $campaign->sync_bar_promo) {
                return null;
            }

            $discount = (int) $campaign->discount_percent;
            $typeLabel = $campaign->isFlashSale() ? 'Flash Sale' : 'Promo';

            return [
                'text' => "{$typeLabel} {$campaign->name}: diskon {$discount}% sedang berlangsung",
                'href' => filled($campaign->sync_banner_link_url)
                    ? (string) $campaign->sync_banner_link_url
                    : ($campaign->isFlashSale() ? '/flash-sale' : '/promo'),
            ];
        });
    }

    private static function liveCampaignWithBanner(): ?Promotion
    {
        $now = now();

        return Promotion::query()
            ->whereIn('status', [Promotion::STATUS_ACTIVE])
            ->orWhere(function ($query) use ($now) {
                $query->where('status', Promotion::STATUS_SCHEDULED)
                    ->where('starts_at', '<=', $now);
            })
            ->where(function ($query) {
                $query->whereNotNull('sync_banner_image_url')
                    ->orWhere('sync_bar_promo', true);
            })
            ->orderByDesc('type') // flash_sale di atas store (sort: 'store' < 'flash_sale' desc gives flash first)
            ->orderByDesc('updated_at')
            ->first();
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::BAR_CACHE_KEY);
        // Banner beranda dicache oleh HomepagePromotions (5 menit); flush supaya
        // slide kampanye langsung muncul/hilang tanpa menunggu cache expired.
        Cache::forget('home.promo_slides');
    }
}
