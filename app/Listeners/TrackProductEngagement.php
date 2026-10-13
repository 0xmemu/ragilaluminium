<?php

namespace App\Listeners;

use App\Events\ProductEngagementRecorded;
use App\Services\ProductEngagementService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Throwable;

/**
 * Proses engagement produk di queue (async). Kegagalan metrik tidak boleh
 * mengganggu operasi lain.
 */
class TrackProductEngagement implements ShouldQueue
{
    public string $queue = 'default';

    public function __construct(protected ProductEngagementService $engagement)
    {
    }

    public function handle(ProductEngagementRecorded $event): void
    {
        try {
            if ($event->action === 'view') {
                $this->engagement->trackView($event->productId);

                return;
            }

            $this->engagement->trackClick($event->productId);
        } catch (Throwable) {
            // Never break storefront navigation on metrics failure.
        }
    }
}