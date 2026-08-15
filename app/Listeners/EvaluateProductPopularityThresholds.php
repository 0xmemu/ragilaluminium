<?php

namespace App\Listeners;

use App\Events\OrderProcessingStarted;
use App\Events\ShippingStatusUpdated;
use App\Models\ProductPopularityBoost;
use App\Services\ProductPopularityService;

class EvaluateProductPopularityThresholds
{
    public function __construct(
        private ProductPopularityService $popularity,
    ) {
    }

    public function handle(OrderProcessingStarted|ShippingStatusUpdated $event): void
    {
        if (! Product::popularityBoostTableAvailable()) {
            return;
        }

        $productIds = $event->order->items()->pluck('product_id');

        if ($productIds->isEmpty()) {
            return;
        }

        ProductPopularityBoost::query()
            ->enabled()
            ->whereIn('source_product_id', $productIds)
            ->get()
            ->each(fn (ProductPopularityBoost $boost) => $this->popularity->evaluateThreshold($boost));
    }
}
