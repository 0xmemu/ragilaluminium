<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPopularityBoost extends Model
{
    protected $fillable = [
        'source_product_id',
        'target_product_id',
        'enabled',
        'seed_sold_count',
        'notification_threshold',
        'threshold_notified_at',
        'disabled_at',
        'disabled_by_user_id',
        'disabled_reason',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'seed_sold_count' => 'integer',
        'notification_threshold' => 'integer',
        'threshold_notified_at' => 'datetime',
        'disabled_at' => 'datetime',
    ];

    public function sourceProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'source_product_id');
    }

    public function targetProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'target_product_id');
    }

    public function disabledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'disabled_by_user_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }
}
