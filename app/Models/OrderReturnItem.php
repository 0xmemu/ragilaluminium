<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderReturnItem extends Model
{
    protected $fillable = [
        'return_case_id',
        'order_item_id',
        'requested_quantity',
        'returned_quantity',
    ];

    protected $casts = [
        'requested_quantity' => 'integer',
        'returned_quantity' => 'integer',
    ];

    public function returnCase(): BelongsTo
    {
        return $this->belongsTo(OrderReturnCase::class, 'return_case_id');
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
