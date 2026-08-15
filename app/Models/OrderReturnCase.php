<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderReturnCase extends Model
{
    protected $fillable = [
        'order_id',
        'status',
        'reason',
        'resolution_type',
        'customer_notes',
        'admin_notes',
        'refund_amount',
        'replacement_amount',
        'additional_shipping_amount',
        'completed_at',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'refund_amount' => 'decimal:2',
        'replacement_amount' => 'decimal:2',
        'additional_shipping_amount' => 'decimal:2',
        'completed_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderReturnItem::class, 'return_case_id');
    }
}
