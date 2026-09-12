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

    /**
     * Ongkir ASLI dari konsol J&T Cargo per pesanan.
     *
     * Hanya record aktif (bukan cancelled) yang punya nilai yang menang;
     * record terbaru dipakai bila ada lebih dari satu. Pesanan yang belum
     * dicatat tidak muncul di hasil, dan pemanggil memakai asumsi ongkir
     * checkout untuk pesanan itu.
     *
     * @param  iterable<int|string>  $orderIds
     * @return array<int, float>  order_id => ongkir asli
     */
    public static function actualOngkirByOrder(iterable $orderIds): array
    {
        $ids = collect($orderIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return static::query()
            ->whereIn('order_id', $ids)
            ->whereNotIn('status', ['cancelled'])
            ->whereNotNull('shipping_cost')
            ->orderBy('id')
            ->get(['order_id', 'shipping_cost'])
            ->groupBy('order_id')
            ->map(fn ($rows): float => (float) $rows->last()->shipping_cost)
            ->all();
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
    public function trackingEvents(): HasMany
    {
        return $this->hasMany(ShippingTrackingEvent::class);
    }
}
