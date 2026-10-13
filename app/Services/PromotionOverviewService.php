<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\CmsBanner;
use App\Models\Promotion;
use App\Models\StoreVoucher;
use Illuminate\Support\Carbon;

/**
 * Ringkasan semua jenis promosi yang sedang berjalan untuk halaman
 * overview Harga & Promo (default /admin/promotions tanpa type).
 *
 * "Berjalan" untuk tiap jenis:
 * - Diskon Reguler / Flash Sale: kampanye live (status scheduled/active dan
 *   jendela waktu mencakup sekarang) atau terjadwal mulai di masa depan.
 * - Voucher: published dan berada di dalam jadwal starts_at..ends_at.
 * - Banner & Bar Promo: published (jadwal opsional ikut dicatat bila ada).
 */
final class PromotionOverviewService
{
    public function __construct(protected CampaignService $campaigns) {}

    /**
     * Kampanye diskon (reguler + flash sale) untuk tabel gabungan.
     *
     * @return list<array<string, mixed>>
     */
    public function campaignRows(): array
    {
        $now = now();

        return Promotion::query()
            ->with('items')
            ->orderByRaw('CASE WHEN status IN (?, ?) THEN 0 ELSE 1 END', [
                Promotion::STATUS_ACTIVE,
                Promotion::STATUS_SCHEDULED,
            ])
            ->orderBy('type')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Promotion $p) use ($now) {
                $live = $this->campaigns->liveCampaigns()->firstWhere('id', $p->id) !== null;
                $scheduled = ! $live
                    && $p->status === Promotion::STATUS_SCHEDULED
                    && $p->starts_at !== null
                    && $p->starts_at->isFuture();

                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'type' => $p->type,
                    'type_label' => $p->isFlashSale() ? 'Flash Sale' : 'Diskon Reguler',
                    'status' => $p->status,
                    'live' => $live,
                    'scheduled' => $scheduled,
                    'discount_percent' => (int) $p->discount_percent,
                    'starts_at' => $p->starts_at?->toIso8601String(),
                    'ends_at' => $p->ends_at?->toIso8601String(),
                    'products_count' => $this->campaigns->resolveProductIds(collect($p->items)->map(fn ($item) => [
                        'target_type' => $item->target_type,
                        'target_id' => $item->target_id,
                        'excluded' => (bool) $item->excluded,
                    ]))->count(),
                    'detail_href' => route('admin.promotions.show', $p),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Voucher yang sedang berlaku (published + di dalam jadwal).
     *
     * @return list<array<string, mixed>>
     */
    public function voucherRows(): array
    {
        $now = now();

        return StoreVoucher::query()
            ->published()
            ->get()
            ->filter(fn (StoreVoucher $voucher) => $voucher->isCurrentlyRunnable($now))
            ->sortByDesc('ends_at')
            ->values()
            ->map(fn (StoreVoucher $voucher) => [
                'id' => $voucher->id,
                'name' => $voucher->name,
                'code' => $voucher->code,
                'discount_label' => $voucher->discount_type === 'percent'
                    ? ((int) $voucher->discount_value).'%'
                    : 'Rp '.number_format((float) $voucher->discount_value, 0, ',', '.'),
                'ends_at' => $voucher->ends_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Banner promo yang terbit.
     *
     * @return list<array<string, mixed>>
     */
    public function bannerRows(): array
    {
        return CmsBanner::query()
            ->published()
            ->orderBy('sort_order')
            ->get(['id', 'title', 'link_url', 'published'])
            ->map(fn (CmsBanner $banner) => [
                'id' => $banner->id,
                'title' => $banner->title ?: ('Banner #'.$banner->id),
                'link_url' => $banner->link_url,
            ])
            ->all();
    }

    /**
     * Bar promo yang terbit dan sedang dalam jadwal (bila diisi).
     *
     * @return list<array<string, mixed>>
     */
    public function announcementRows(): array
    {
        // Bentuk yang sama dengan scope published()..active(), tetapi disusun
        // dalam SATU query: dulu setiap baris menjalankan query EXISTS sendiri
        // sehingga jumlah query tumbuh seiring jumlah bar promo.
        return Announcement::query()
            ->published()
            ->active()
            ->orderBy('sort_order')
            ->get()
            ->values()
            ->map(fn (Announcement $item) => [
                'id' => $item->id,
                'text' => $item->text,
                'starts_at' => $item->starts_at?->toDateString(),
                'ends_at' => $item->ends_at?->toDateString(),
            ])
            ->all();
    }

    /** Jumlah per jenis untuk kartu ringkas di bagian atas halaman. */
    public function counts(): array
    {
        $now = now();

        $reguler = Promotion::query()->where('type', Promotion::TYPE_STORE)->get();
        $flash = Promotion::query()->where('type', Promotion::TYPE_FLASH_SALE)->get();
        $liveIds = $this->campaigns->liveCampaigns()->pluck('id')->all();

        $inWindow = function ($collection) use ($liveIds, $now) {
            return $collection->filter(function (Promotion $p) use ($liveIds, $now) {
                if (in_array($p->id, $liveIds, true)) {
                    return true;
                }

                return $p->status === Promotion::STATUS_SCHEDULED
                    && $p->starts_at !== null
                    && $p->starts_at->isFuture();
            })->count();
        };

        $vouchers = StoreVoucher::query()
            ->published()
            ->get()
            ->filter(fn (StoreVoucher $voucher) => $voucher->isCurrentlyRunnable($now))
            ->count();

        return [
            'diskon_reguler' => $inWindow($reguler),
            'flash_sale' => $inWindow($flash),
            'voucher' => $vouchers,
            'banner' => CmsBanner::query()->published()->count(),
            // Hitung sekali saja (dulu daftar bar promo dibangun dua kali).
            'bar_promo' => count($this->announcementRows()),
        ];
    }
}
