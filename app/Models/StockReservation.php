<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReservation extends Model
{
    protected $fillable = [
        'product_variant_id',
        'quantity',
        'status',
        'expires_at',
        'reference_type',
        'reference_id',
        'released_at',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}