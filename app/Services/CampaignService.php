<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Promotion;
use App\Models\PromotionItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Kampanye Promo Toko & Flash Sale (SPESIFIKASI-FINAL §C).
 *
 * Aturan bisnis:
 * - 1 produk = 1 promo (Promo Toko) aktif.
 * - Hanya 1 Flash Sale aktif.
 * - Diskont Flash Sale wajib > Diskon Produk (Promo Toko aktif yang meliputi produk).
 * - Duplikat kampanye; akhiri manual; konfirmasi dampak; log aktivitas.
 */
final class CampaignService
{
    private ?Collection $liveCache = null;

    /**
     * Key Redis untuk hasil resolusi kampanye lintas-request.
     * Nilai serialize-able; di-invalidasi via flushCache() saat admin
     * mengubah/aktivasi/akhiri kampanye. TTL pendek agar tetap segar.
     */
    private const REDIS_KEYS = [
        'campaign:promo-ids:v1',
        'campaign:flash-ids:v1',
        'campaign:flash-period:v1',
    ];

    private const REDIS_TTL_SECONDS = 120;

    public function flushCache(): void
    {
        $this->liveCache = null;
        foreach (self::REDIS_KEYS as $key) {
            Cache::forget($key);
        }
    }

    /**
     * Kampanye yang live: status aktif, atau terjadwal yang sudah mulai,
     * dan jendela waktu (starts_at..ends_at) mencakup sekarang.
     *
     * @return Collection<int, Promotion>
     */
    public function liveCampaigns(): Collection
    {
        if ($this->liveCache !== null) {
            return $this->liveCache;
        }

        $now = now();

        $this->liveCache = Promotion::query()
            ->where(function ($query) use ($now) {
                $query->where('status', Promotion::STATUS_ACTIVE)
                    ->orWhere(function ($query) use ($now) {
                        $query->where('status', Promotion::STATUS_SCHEDULED)
                            ->where('starts_at', '<=', $now);
                    });
            })
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>', $now);
            })
            ->with('items')
            ->get();

        return $this->liveCache;
    }

    /**
     * ID produk tercakup kampanye Flash Sale live.
     *
     * @return list<int>
     */
    public function flashProductIds(): array
    {
        return Cache::remember(self::REDIS_KEYS[1], self::REDIS_TTL_SECONDS, fn () => $this->productIdsForType(Promotion::TYPE_FLASH_SALE));
    }

    /**
     * ID produk tercakup kampanye Promo Toko live.
     *
     * @return list<int>
     */
    public function promoProductIds(): array
    {
        return Cache::remember(self::REDIS_KEYS[0], self::REDIS_TTL_SECONDS, fn () => $this->productIdsForType(Promotion::TYPE_STORE));
    }

    /**
     * @return list<int>
     */
    private function productIdsForType(string $type): array
    {
        $campaign = $this->liveCampaigns()->firstWhere('type', $type);

        if ($campaign === null) {
            return [];
        }

        return $this->resolveProductIds(collect($campaign->items))->values()->all();
    }

    /**
     * Periode Flash Sale dari kampanye live; null jika tidak ada kampanye live.
     *
     * @return array{enabled: bool, starts_at: string|null, ends_at: string|null}|null
     */
    public function flashPeriod(): ?array
    {
        return Cache::remember(self::REDIS_KEYS[2], self::REDIS_TTL_SECONDS, function (): ?array {
            $flash = $this->liveCampaigns()->firstWhere('type', Promotion::TYPE_FLASH_SALE);

            if ($flash === null) {
                return null;
            }

            return [
                'enabled' => true,
                'starts_at' => $flash->starts_at?->toIso8601String(),
                'ends_at' => $flash->ends_at?->toIso8601String(),
            ];
        });
    }

    /**
     * Cakupan kampanye live untuk satu produk (+ varian opsional).
     *
     * @return array{
     *     store: array{id: int, name: string, discount_percent: int}|null,
     *     flash: array{id: int, name: string, discount_percent: int}|null,
     * }
     */
    public function forProduct(Product $product, ?ProductVariant $variant = null): array
    {
        $result = ['store' => null, 'flash' => null];

        foreach ($this->liveCampaigns() as $campaign) {
            $item = $this->matchingItem($campaign, $product, $variant);
            if ($item === null) {
                continue;
            }

            $entry = [
                'id' => (int) $campaign->id,
                'name' => $campaign->name,
                'discount_percent' => $item->override_discount_percent ?? (int) $campaign->discount_percent,
            ];

            if ($campaign->isFlashSale()) {
                if ($result['flash'] === null) {
                    $result['flash'] = $entry;
                }
            } elseif ($result['store'] === null) {
                $result['store'] = $entry;
            }
        }

        return $result;
    }

    /** Diskon Promo Toko efektif untuk produk (0 jika tidak ada). */
    public function storeDiscountForProduct(Product $product, ?ProductVariant $variant = null): int
    {
        return (int) ($this->forProduct($product, $variant)['store']['discount_percent'] ?? 0);
    }

    /**
     * Validasi kampanye sebelum simpan/aktifkan.
     *
     * @param  list<array{target_type: string, target_id: string|int, excluded?: bool, override_discount_percent?: int|null}>  $targets
     */
    public function validate(
        Promotion $campaign,
        array $targets,
        ?int $exceptPromotionId = null,
    ): void {
        $errors = [];

        if ($campaign->discount_percent < 1 || $campaign->discount_percent > 90) {
            $errors['discount_percent'] = 'Diskon harus antara 1% dan 90%.';
        }

        if ($campaign->starts_at !== null && $campaign->ends_at !== null
            && $campaign->ends_at->lte($campaign->starts_at)) {
            $errors['ends_at'] = 'Periode berakhir harus setelah periode mulai.';
        }

        // Nama unik saat aktif (scheduled|active) untuk tipe yang sama.
        $nameConflict = Promotion::query()
            ->where('id', '!=', $exceptPromotionId)
            ->where('type', $campaign->type)
            ->whereIn('status', [Promotion::STATUS_SCHEDULED, Promotion::STATUS_ACTIVE])
            ->where('name', $campaign->name)
            ->exists();
        if ($nameConflict) {
            $errors['name'] = 'Nama promo sudah digunakan pada kampanye aktif.';
        }

        $included = collect($targets)
            ->filter(fn ($target) => ($target['excluded'] ?? false) !== true)
            ->values();

        if ($included->isEmpty()) {
            $errors['targets'] = 'Minimal satu target produk/model/sub model.';
        }

        // Hanya 1 Flash Sale aktif.
        if ($campaign->isFlashSale()) {
            $flashConflict = Promotion::query()
                ->where('id', '!=', $exceptPromotionId)
                ->where('type', Promotion::TYPE_FLASH_SALE)
                ->whereIn('status', [Promotion::STATUS_SCHEDULED, Promotion::STATUS_ACTIVE])
                ->exists();
            if ($flashConflict) {
                $errors['type'] = 'Hanya satu Flash Sale yang boleh aktif. Akhiri kampanye Flash Sale lain terlebih dahulu.';
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $productIds = $this->resolveProductIds($included);

        // 1 produk = 1 promo aktif (Promo Toko).
        if ($campaign->type === Promotion::TYPE_STORE) {
            $covered = $this->liveProductCoverage($productIds, Promotion::TYPE_STORE, $exceptPromotionId);
            if ($covered->isNotEmpty()) {
                $first = $covered->first();
                $errors['targets'] = 'Produk '.($first['parent_sku'] ?? '#'.$first['product_id'])
                    .' sudah masuk promo aktif "'.$first['name'].'" ('.$first['discount_percent'].'%). '
                    .'Satu produk hanya boleh terdaftar di satu promo aktif.';
            }
        }

        // Flash Sale wajib > Diskon Produk (Promo Toko aktif).
        if ($campaign->isFlashSale() && $productIds->isNotEmpty()) {
            $promoCovered = $this->liveProductCoverage($productIds, Promotion::TYPE_STORE);
            if ($promoCovered->isNotEmpty()) {
                $first = $promoCovered->first();
                $promoPercent = (int) $first['discount_percent'];
                if ($campaign->discount_percent <= $promoPercent) {
                    $errors['discount_percent'] = 'Diskon Flash Sale harus lebih besar daripada Diskon Produk '
                        .'(Promo Toko "'.$first['name'].'" aktif '.$promoPercent.'% pada produk '
                        .($first['parent_sku'] ?? '#'.$first['product_id']).').';
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Jumlah produk & varian terdampak (konfirmasi dampak sebelum simpan/aktifkan).
     *
     * @param  list<array{target_type: string, target_id: string|int, excluded?: bool}>  $targets
     * @return array{products: int, variants: int}
     */
    public function affectedCounts(array $targets): array
    {
        $productIds = $this->resolveProductIds(collect($targets));

        return [
            'products' => $productIds->count(),
            'variants' => ProductVariant::whereIn('product_id', $productIds)
                ->where('status', 'active')
                ->count(),
        ];
    }

    public function duplicate(Promotion $campaign, int $userId): Promotion
    {
        $copy = Promotion::create([
            'type' => $campaign->type,
            'name' => $campaign->name.' (Salinan)',
            'status' => Promotion::STATUS_DRAFT,
            'starts_at' => $campaign->starts_at,
            'ends_at' => $campaign->ends_at,
            'discount_percent' => $campaign->discount_percent,
            'sync_banner' => (bool) $campaign->sync_banner,
            'created_by_user_id' => $userId,
            'updated_by_user_id' => $userId,
        ]);

        foreach ($campaign->items as $item) {
            PromotionItem::create([
                'promotion_id' => $copy->id,
                'target_type' => $item->target_type,
                'target_id' => $item->target_id,
                'excluded' => $item->excluded,
                'override_discount_percent' => $item->override_discount_percent,
                'created_by_user_id' => $userId,
            ]);
        }

        ActivityLogService::record(
            'product.promotion.duplicated',
            'promotion',
            $copy->id,
            ['name' => $copy->name, 'from' => $campaign->id],
            $userId,
        );

        return $copy;
    }

    public function endEarly(Promotion $campaign, int $userId): void
    {
        $campaign->update([
            'status' => Promotion::STATUS_ENDED,
            'updated_by_user_id' => $userId,
        ]);

        ActivityLogService::record(
            'product.promotion.ended',
            'promotion',
            $campaign->id,
            ['name' => $campaign->name],
            $userId,
        );

        $this->flushCache();
    }

    public function activate(Promotion $campaign, int $userId): void
    {
        $campaign->update([
            'status' => Promotion::STATUS_ACTIVE,
            'updated_by_user_id' => $userId,
        ]);

        ActivityLogService::record(
            'product.promotion.activated',
            'promotion',
            $campaign->id,
            ['name' => $campaign->name],
            $userId,
        );

        $this->flushCache();
    }

    /**
     * @param  Collection<int, array{target_type: string, target_id: string|int, excluded?: bool}>  $targets
     * @return Collection<int, int>
     */
    public function resolveProductIds(Collection $targets): Collection
    {
        $included = $targets->filter(fn ($target) => ($target['excluded'] ?? false) !== true);

        $productIds = collect();
        $modelTargets = collect();
        $subModelTargets = collect();

        foreach ($included as $target) {
            match ($target['target_type']) {
                PromotionItem::TARGET_PRODUCT => $productIds->push((int) $target['target_id']),
                PromotionItem::TARGET_MODEL => $modelTargets->push((string) $target['target_id']),
                PromotionItem::TARGET_SUB_MODEL => $subModelTargets->push((string) $target['target_id']),
                default => null,
            };
        }

        $productIds = $productIds->unique();

        if ($modelTargets->isNotEmpty()) {
            $productIds = $productIds->concat(
                Product::whereIn('product_model', $modelTargets->all())->pluck('id')
            );
        }

        if ($subModelTargets->isNotEmpty()) {
            $productIds = $productIds->concat(
                Product::whereIn('design_variant', $subModelTargets->all())->pluck('id')
            );
        }

        // Produk yang dikecualikan (target product excluded) dikeluarkan.
        $excludedIds = $targets
            ->filter(fn ($target) => $target['target_type'] === PromotionItem::TARGET_PRODUCT
                && ($target['excluded'] ?? false) === true)
            ->pluck('target_id')
            ->map(fn ($id) => (int) $id);

        return $productIds
            ->reject(fn ($id) => $excludedIds->contains((int) $id))
            ->unique()
            ->values();
    }

    /**
     * Produk dalam $productIds yang sudah dicakup kampanye live bertipe $type.
     *
     * @param  Collection<int, int>  $productIds
     * @return Collection<int, array{product_id: int, parent_sku: string|null, name: string, discount_percent: int}>
     */
    public function liveProductCoverage(Collection $productIds, string $type, ?int $exceptPromotionId = null): Collection
    {
        if ($productIds->isEmpty()) {
            return collect();
        }

        $promotions = $this->liveCampaigns()
            ->where('type', $type)
            ->where('id', '!=', $exceptPromotionId);

        if ($promotions->isEmpty()) {
            return collect();
        }

        $skuById = Product::whereIn('id', $productIds)->pluck('parent_sku', 'id');

        $covered = collect();

        foreach ($promotions as $campaign) {
            foreach ($campaign->items as $item) {
                if ($item->excluded) {
                    continue;
                }

                $matches = match ($item->target_type) {
                    PromotionItem::TARGET_PRODUCT => $productIds->contains((int) $item->target_id)
                        ? collect([(int) $item->target_id])
                        : collect(),
                    PromotionItem::TARGET_MODEL => Product::whereIn('id', $productIds)
                        ->where('product_model', (string) $item->target_id)
                        ->pluck('id'),
                    PromotionItem::TARGET_SUB_MODEL => Product::whereIn('id', $productIds)
                        ->where('design_variant', (string) $item->target_id)
                        ->pluck('id'),
                    default => collect(),
                };

                foreach ($matches as $productId) {
                    $covered->push([
                        'product_id' => (int) $productId,
                        'parent_sku' => $skuById[(int) $productId] ?? null,
                        'name' => $campaign->name,
                        'discount_percent' => $item->override_discount_percent ?? (int) $campaign->discount_percent,
                    ]);
                }
            }
        }

        return $covered->unique('product_id')->values();
    }

    private function matchingItem(Promotion $campaign, Product $product, ?ProductVariant $variant = null): ?PromotionItem
    {
        $matched = null;

        foreach ($campaign->items as $item) {
            $isMatch = match ($item->target_type) {
                PromotionItem::TARGET_PRODUCT => (int) $item->target_id === (int) $product->id
                    || ($variant !== null && (int) $item->target_id === (int) $variant->id),
                PromotionItem::TARGET_MODEL => (string) $item->target_id === $product->product_model,
                PromotionItem::TARGET_SUB_MODEL => (string) $item->target_id === $product->design_variant,
                default => false,
            };

            if (! $isMatch) {
                continue;
            }

            if ($item->excluded) {
                if ($item->target_type === PromotionItem::TARGET_PRODUCT
                    && (int) $item->target_id === (int) $product->id) {
                    return null;
                }
                if ($variant !== null
                    && $item->target_type === PromotionItem::TARGET_PRODUCT
                    && (int) $item->target_id === (int) $variant->id) {
                    return null;
                }

                continue;
            }

            if ($matched === null) {
                $matched = $item;
            }
        }

        return $matched;
    }
}
