<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Engagement produk storefront (click/view). Diproses async oleh
 * TrackProductEngagement listener agar tidak membebani response.
 */
class ProductEngagementRecorded
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly int $productId,
        public readonly string $action, // click | view
    ) {
    }
}