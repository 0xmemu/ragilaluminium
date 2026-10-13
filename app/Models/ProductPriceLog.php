<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPriceLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'product_variant_id',
        'price_before',
        'price_after',
        'source',
        'reason',
        'changed_by_user_id',
        'created_at',
    ];

    protected $casts = [
        'price_before' => 'decimal:2',
        'price_after' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}