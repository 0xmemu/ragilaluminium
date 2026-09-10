<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Legacy helper sinkronisasi banner kampanye.
 *
 * Kontrak baru (2026-09-10): SEMUA banner beranda dikelola lewat menu
 * Banner Promosi (CmsBanner). Kampanye/Flash Sale tidak lagi memiliki
 * field sync banner sendiri agar tidak redundan. Helper ini hanya
 * menjaga kompatibilitas pemanggil lama dan selalu mengembalikan null.
 */
class CampaignBannerSync
{
    public const CACHE_KEY = 'campaign.sync_banner';
    public const BAR_CACHE_KEY = 'campaign.sync_bar';

    /** @return array|null{title: string, image_url: string, link_url: string} */
    public static function activeBanner(): ?array
    {
        return null;
    }

    /** @return array|null{text: string, href: string} */
    public static function activeBarPromo(): ?array
    {
        return null;
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::BAR_CACHE_KEY);
        Cache::forget('home.promo_slides');
    }
}
