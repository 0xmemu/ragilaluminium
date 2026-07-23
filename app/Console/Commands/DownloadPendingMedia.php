<?php

namespace App\Console\Commands;

use App\Jobs\DownloadProductMedia;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Console\Command;

class DownloadPendingMedia extends Command
{
    protected $signature = 'media:download-pending
                            {--main-only : Only main product images (storefront cards/banners)}
                            {--display-only : Only products visible on Home and first catalog pages}
                            {--limit=0 : Max rows to process (0 = all)}
                            {--after-id=0 : Only rows with id greater than this (for parallel shards)}
                            {--chunk=50 : Progress report every N rows}';

    protected $description = 'Download pending/failed product_media from source_url (prioritize --main-only for storefront)';

    public function handle(MediaDerivativeService $derivatives): int
    {
        $mainOnly = (bool) $this->option('main-only');
        $displayOnly = (bool) $this->option('display-only');
        $limit = max(0, (int) $this->option('limit'));
        $afterId = max(0, (int) $this->option('after-id'));
        $chunk = max(1, (int) $this->option('chunk'));

        // Stuck mid-download (worker killed) → allow retry.
        $stuck = ProductMedia::query()
            ->where('status', 'downloading')
            ->where('updated_at', '<', now()->subMinutes(10))
            ->update(['status' => 'pending', 'error_reason' => null]);
        if ($stuck > 0) {
            $this->warn("Reset {$stuck} stuck downloading row(s) to pending.");
        }

        $displayProductIds = $displayOnly ? $this->displayProductIds() : collect();

        $query = ProductMedia::query()
            ->whereIn('status', ['pending', 'failed'])
            ->whereNotNull('source_url')
            ->when($mainOnly || $displayOnly, fn ($q) => $q->where('is_main_image', true))
            ->when($displayOnly, fn ($q) => $q->whereIn('product_id', $displayProductIds))
            ->when($afterId > 0, fn ($q) => $q->where('id', '>', $afterId))
            ->orderBy('id');

        if ($limit > 0) {
            $query->limit($limit);
        }

        $ids = $query->pluck('id');
        $total = $ids->count();
        $scope = $displayOnly ? 'Display main images' : ($mainOnly ? 'Main images' : 'Media');
        $this->info("{$scope} to download: {$total}".($afterId ? " (after id {$afterId})" : ''));

        if ($total === 0) {
            return self::SUCCESS;
        }

        $ok = 0;
        $fail = 0;
        $i = 0;

        foreach ($ids as $mediaId) {
            $i++;
            try {
                (new DownloadProductMedia((int) $mediaId))->handle($derivatives);
                $media = ProductMedia::find($mediaId);
                if ($media?->status === 'downloaded') {
                    $ok++;
                } else {
                    $fail++;
                    $this->error("Media {$mediaId}: ".($media?->error_reason ?? 'not downloaded'));
                }
            } catch (\Throwable $e) {
                $fail++;
                $this->error("Media {$mediaId}: {$e->getMessage()}");
            }

            if ($i % $chunk === 0 || $i === $total) {
                $this->line("Progress {$i}/{$total} (ok={$ok} fail={$fail} last_id={$mediaId})");
                if (function_exists('ob_get_level') && ob_get_level() > 0) {
                    @ob_flush();
                }
                @flush();
            }
        }

        $this->info("Done. ok={$ok} fail={$fail}");

        return $fail > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Product IDs needed immediately: Home featured/popular, first 24 cards
     * per category, and one current sample per category/model for model cards.
     */
    private function displayProductIds()
    {
        $ids = Product::visible()->latest()->limit(8)->pluck('id')
            ->merge(
                Product::visible()
                    ->homepagePopular()
                    ->orderBy('homepage_popular_sort')
                    ->limit(10)
                    ->pluck('id')
            );

        foreach (['WINDOW', 'DOOR', 'BOUVEN'] as $category) {
            $ids = $ids->merge(
                Product::visible()
                    ->where('product_category', $category)
                    ->latest('created_at')
                    ->orderByDesc('id')
                    ->limit(24)
                    ->pluck('id')
            );
        }

        $modelSamples = Product::visible()
            ->latest('created_at')
            ->get(['id', 'product_category', 'product_model'])
            ->unique(fn (Product $product) => $product->product_category.'|'.$product->product_model)
            ->pluck('id');

        return $ids->merge($modelSamples)->unique()->values();
    }
}
