<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShippingTrackingEvent extends Model
{
    protected $fillable = [
        'shipping_record_id',
        'order_id',
        'provider',
        'waybill_number',
        'provider_status',
        'normalized_status',
        'source',
        'location',
        'description',
        'occurred_at',
        'event_hash',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
    ];

    public function shippingRecord(): BelongsTo
    {
        return $this->belongsTo(ShippingRecord::class);
    }
    protected static function booted(): void
    {
        static::updating(static fn (): never => throw new LogicException('Shipping tracking events are immutable.'));
        static::deleting(static fn (): never => throw new LogicException('Shipping tracking events are immutable.'));
    }


    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
