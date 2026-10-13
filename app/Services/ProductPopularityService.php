<?php

namespace App\Services;

use App\Models\AdminNotification;
use App\Models\CmsTestimonial;
use App\Services\ActivityLogService;
use App\Models\Product;
use App\Models\ProductPopularityBoost;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductPopularityService
{
    public const EVENT_ENABLED = 'product_popularity_boost.enabled';
    public const EVENT_DISABLED = 'product_popularity_boost.disabled';
    public const EVENT_DELETED = 'product_popularity_boost.deleted';
    public const EVENT_UPDATED = 'product_popularity_boost.updated';
    public const EVENT_THRESHOLD = 'product_popularity_boost.threshold_reached';

    public function orderByPopularity(Builder $query): Builder
    {
        return $query
            ->withPopularityScore()
            ->orderByRaw(Product::popularityScoreSql().' DESC');
    }

    /**
     * @return array{boost: ProductPopularityBoost, seed: int, current_score: int}
     */
    public function enable(
        int $sourceProductId,
        int $targetProductId,
        ?int $threshold,
        ?int $userId,
    ): array {
        if ($sourceProductId === $targetProductId) {
            throw ValidationException::withMessages([
                'source_product_id' => 'Produk sumber dan target harus berbeda.',
            ]);
        }

        $source = Product::query()->where('status', 'active')->find($sourceProductId);
        $target = Product::query()->where('status', 'active')->find($targetProductId);

        if (! $source) {
            throw ValidationException::withMessages([
                'source_product_id' => 'Produk sumber harus aktif.',
            ]);
        }
        if (! $target) {
            throw ValidationException::withMessages([
                'target_product_id' => 'Produk target harus aktif.',
            ]);
        }

        $hasAnotherActiveBoost = ProductPopularityBoost::query()
            ->enabled()
            ->where('target_product_id', $target->id)
            ->where('source_product_id', '!=', $source->id)
            ->exists();

        if ($hasAnotherActiveBoost) {
            throw ValidationException::withMessages([
                'target_product_id' => 'Produk target sudah memiliki Teruskan Popularitas aktif dari sumber lain. Nonaktifkan konfigurasi tersebut terlebih dahulu.',
            ]);
        }

        $seed = (int) $source->validOrderItems()->sum('quantity');

        $boost = DB::transaction(function () use ($source, $target, $seed, $threshold, $userId): ProductPopularityBoost {
            $boost = ProductPopularityBoost::query()->firstOrNew([
                'source_product_id' => $source->id,
                'target_product_id' => $target->id,
            ]);

            $boost->fill([
                'enabled' => true,
                'seed_sold_count' => $seed,
                'notification_threshold' => $threshold,
                'threshold_notified_at' => null,
                'disabled_at' => null,
                'disabled_by_user_id' => null,
                'disabled_reason' => null,
                'updated_by_user_id' => $userId,
            ]);
            if (! $boost->exists) {
                $boost->created_by_user_id = $userId;
            }
            $boost->save();

            Product::query()->whereKey($target->id)->update([
                'popularity_seed' => $seed,
                'popularity_seed_source_product_id' => $source->id,
                'popularity_seed_applied_at' => now(),
                'popularity_seed_applied_by_user_id' => $userId,
            ]);

            return $boost->fresh(['sourceProduct', 'targetProduct']);
        });

        ActivityLogService::record(self::EVENT_ENABLED, 'product_popularity_boost', $boost->id, [
            'source_product_id' => $source->id,
            'target_product_id' => $target->id,
            'seed_sold_count' => $seed,
            'threshold' => $threshold,
        ], $userId);

        $this->evaluateThreshold($boost);

        return [
            'boost' => $boost->fresh(['sourceProduct', 'targetProduct']),
            'seed' => $seed,
            'current_score' => $seed + (int) $target->validOrderItems()->sum('quantity'),
        ];
    }

    public function disable(ProductPopularityBoost $boost, ?string $reason, ?int $userId): ProductPopularityBoost
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ValidationException::withMessages([
                'reason' => 'Alasan penonaktifan wajib diisi.',
            ]);
        }

        DB::transaction(function () use ($boost, $reason, $userId): void {
            $boost->update([
                'enabled' => false,
                'disabled_at' => now(),
                'disabled_by_user_id' => $userId,
                'disabled_reason' => $reason,
                'updated_by_user_id' => $userId,
            ]);

            Product::query()
                ->whereKey($boost->target_product_id)
                ->where('popularity_seed_source_product_id', $boost->source_product_id)
                ->update([
                    'popularity_seed' => 0,
                    'popularity_seed_source_product_id' => null,
                    'popularity_seed_applied_at' => null,
                    'popularity_seed_applied_by_user_id' => null,
                ]);
        });

        ActivityLogService::record(self::EVENT_DISABLED, 'product_popularity_boost', $boost->id, [
            'source_product_id' => $boost->source_product_id,
            'target_product_id' => $boost->target_product_id,
            'reason' => $reason,
            'seed_sold_count' => $boost->seed_sold_count,
        ], $userId);

        AdminNotification::create([
            'type' => 'product_popularity_boost_disabled',
            'related_type' => 'product_popularity_boost',
            'related_id' => $boost->id,
            'title' => 'Teruskan Popularitas dinonaktifkan',
            'body' => 'Boost popularitas target dihentikan. Alasan: '.$reason,
            'href' => route('admin.products.popularity-boosts.index'),
        ]);

        return $boost->fresh(['sourceProduct', 'targetProduct']);
    }

    /**
     * Ubah konfigurasi boost (sumber/target/ambang). Bila boost aktif, seed
     * dihitung ulang dari penjualan sumber terbaru dan target lama dibersihkan
     * ketika pasangan target berpindah. Ambang yang berubah memulai siklus
     * notifikasi baru (threshold_notified_at direset).
     */
    public function update(
        ProductPopularityBoost $boost,
        int $sourceProductId,
        int $targetProductId,
        ?int $threshold,
        ?int $userId,
    ): ProductPopularityBoost {
        if ($sourceProductId === $targetProductId) {
            throw ValidationException::withMessages([
                'target_product_id' => 'Produk sumber dan target harus berbeda.',
            ]);
        }

        $source = Product::query()->where('status', 'active')->find($sourceProductId);
        $target = Product::query()->where('status', 'active')->find($targetProductId);

        if (! $source) {
            throw ValidationException::withMessages([
                'source_product_id' => 'Produk sumber harus aktif.',
            ]);
        }
        if (! $target) {
            throw ValidationException::withMessages([
                'target_product_id' => 'Produk target harus aktif.',
            ]);
        }

        $duplicatePair = ProductPopularityBoost::query()
            ->whereKeyNot($boost->id)
            ->where('source_product_id', $source->id)
            ->where('target_product_id', $target->id)
            ->exists();

        if ($duplicatePair) {
            throw ValidationException::withMessages([
                'target_product_id' => 'Sudah ada konfigurasi Teruskan Popularitas untuk pasangan produk ini.',
            ]);
        }

        if ($boost->enabled) {
            $conflict = ProductPopularityBoost::query()
                ->enabled()
                ->whereKeyNot($boost->id)
                ->where('target_product_id', $target->id)
                ->exists();

            if ($conflict) {
                throw ValidationException::withMessages([
                    'target_product_id' => 'Produk target sudah memiliki Teruskan Popularitas aktif dari sumber lain. Nonaktifkan konfigurasi tersebut terlebih dahulu.',
                ]);
            }
        }

        $before = [
            'source_product_id' => $boost->source_product_id,
            'target_product_id' => $boost->target_product_id,
            'notification_threshold' => $boost->notification_threshold,
        ];

        $seed = $boost->enabled
            ? (int) $source->validOrderItems()->sum('quantity')
            : (int) $boost->seed_sold_count;

        $thresholdChanged = (int) $boost->notification_threshold !== (int) $threshold;

        DB::transaction(function () use ($boost, $source, $target, $seed, $threshold, $thresholdChanged, $userId): void {
            if ((int) $boost->target_product_id !== $target->id) {
                Product::query()
                    ->whereKey($boost->target_product_id)
                    ->where('popularity_seed_source_product_id', $boost->source_product_id)
                    ->update([
                        'popularity_seed' => 0,
                        'popularity_seed_source_product_id' => null,
                        'popularity_seed_applied_at' => null,
                        'popularity_seed_applied_by_user_id' => null,
                    ]);
            }

            $boost->fill([
                'source_product_id' => $source->id,
                'target_product_id' => $target->id,
                'seed_sold_count' => $seed,
                'notification_threshold' => $threshold,
                'updated_by_user_id' => $userId,
            ]);
            if ($thresholdChanged) {
                $boost->threshold_notified_at = null;
            }
            $boost->save();

            if ($boost->enabled) {
                Product::query()->whereKey($target->id)->update([
                    'popularity_seed' => $seed,
                    'popularity_seed_source_product_id' => $source->id,
                    'popularity_seed_applied_at' => now(),
                    'popularity_seed_applied_by_user_id' => $userId,
                ]);
            }
        });

        ActivityLogService::record(self::EVENT_UPDATED, 'product_popularity_boost', $boost->id, [
            'before' => $before,
            'after' => [
                'source_product_id' => $source->id,
                'target_product_id' => $target->id,
                'notification_threshold' => $threshold,
            ],
        ], $userId);

        $fresh = $boost->fresh();
        if ($fresh && $fresh->enabled) {
            $this->evaluateThreshold($fresh);
        }

        return $boost->fresh(['sourceProduct', 'targetProduct']);
    }

    /**
     * Hapus permanen konfigurasi boost. Seed target dikosongkan bila memang
     * berasal dari boost ini, dan notifikasi yang menunjuk ke boost ikut
     * dibersihkan agar tidak menjadi tautan mati. Jejak audit tetap di event_logs.
     */
    public function purge(ProductPopularityBoost $boost, ?int $userId): void
    {
        $payload = [
            'source_product_id' => $boost->source_product_id,
            'target_product_id' => $boost->target_product_id,
            'seed_sold_count' => $boost->seed_sold_count,
            'was_enabled' => (bool) $boost->enabled,
            'disabled_reason' => $boost->disabled_reason,
        ];

        $boostId = $boost->id;

        DB::transaction(function () use ($boost): void {
            Product::query()
                ->whereKey($boost->target_product_id)
                ->where('popularity_seed_source_product_id', $boost->source_product_id)
                ->update([
                    'popularity_seed' => 0,
                    'popularity_seed_source_product_id' => null,
                    'popularity_seed_applied_at' => null,
                    'popularity_seed_applied_by_user_id' => null,
                ]);

            AdminNotification::query()
                ->where('related_type', 'product_popularity_boost')
                ->where('related_id', $boost->id)
                ->delete();

            $boost->delete();
        });

        ActivityLogService::record(self::EVENT_DELETED, 'product_popularity_boost', $boostId, $payload, $userId);
    }

    public function evaluateThreshold(ProductPopularityBoost $boost): bool
    {
        if (! $boost->enabled || ! $boost->notification_threshold || $boost->threshold_notified_at) {
            return false;
        }

        $source = Product::query()->find($boost->source_product_id);
        $sourceSold = $source ? (int) $source->validOrderItems()->sum('quantity') : 0;

        if ($sourceSold < $boost->notification_threshold) {
            return false;
        }

        // Klaim atomik: hanya proses pertama yang mengirim notifikasi, sehingga
        // dua evaluasi bersamaan tidak menghasilkan notifikasi ganda.
        $claimed = ProductPopularityBoost::query()
            ->whereKey($boost->id)
            ->whereNull('threshold_notified_at')
            ->update(['threshold_notified_at' => now()]);

        if (! $claimed) {
            return false;
        }

        $boost->refresh();
        ActivityLogService::record(self::EVENT_THRESHOLD, 'product_popularity_boost', $boost->id, [
            'source_product_id' => $boost->source_product_id,
            'target_product_id' => $boost->target_product_id,
            'source_sold_count' => $sourceSold,
            'threshold' => $boost->notification_threshold,
        ]);

        AdminNotification::create([
            'type' => 'product_popularity_boost_threshold',
            'related_type' => 'product_popularity_boost',
            'related_id' => $boost->id,
            'title' => 'Ambang popularitas tercapai',
            'body' => 'Penjualan produk sumber telah mencapai '.number_format($boost->notification_threshold).' unit.',
            'href' => route('admin.products.popularity-boosts.index'),
        ]);

        return true;
    }

    /**
     * @return Collection<int, CmsTestimonial>
     */
    public function inheritedTestimonials(Product $target): Collection
    {
        if (! Product::popularityBoostTableAvailable()) {
            return CmsTestimonial::query()
                ->published()
                ->website()
                ->forProduct($target->id)
                ->with(['product:id,parent_sku,name,short_name,product_category,product_model,design_variant', 'order.items'])
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->limit(20)
                ->get();
        }

        $sourceIds = ProductPopularityBoost::query()
            ->enabled()
            ->where('target_product_id', $target->id)
            ->pluck('source_product_id');

        return CmsTestimonial::query()
            ->published()
            ->website()
            ->where(function ($query) use ($target, $sourceIds): void {
                // forProduct: ulasan yang menyebut produk ini, ATAU ulasan dari
                // pesanan yang memuat produk ini (keputusan owner 2026-10-06).
                $query->forProduct($target->id);
                if ($sourceIds->isNotEmpty()) {
                    $query->orWhereIn('product_id', $sourceIds);
                }
            })
            ->with(['product:id,parent_sku,name,short_name,product_category,product_model,design_variant', 'order.items'])
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->limit(20)
            ->get();
    }
}
