<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Notifikasi admin (Fase 13): order_created, order_delivered, order_cancelled, shipping_quote_manual_review, media_failed, import_failed, return_created, media_cleanup, popularity_threshold.
 */
class AdminNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'related_type',
        'related_id',
        'title',
        'body',
        'order_id',
        'href',
        'read_at',
    ];

    protected $casts = [
        'order_id' => 'integer',
        'related_id' => 'integer',
        'read_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }
}

