<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingRecord extends Model
{
    protected $fillable = [
        'order_id',
        'carrier_name',
        'service_name',
        'waybill_number',
        'shipping_cost',
        'status',
        'status_raw',
        'last_status_at',
        'tracking_url',
    ];

    protected $casts = [
        'shipping_cost' => 'decimal:2',
        'last_status_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
    public function trackingEvents(): HasMany
    {
        return $this->hasMany(ShippingTrackingEvent::class);
    }
}
