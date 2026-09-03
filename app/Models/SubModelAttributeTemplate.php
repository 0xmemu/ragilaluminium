<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubModelAttributeTemplate extends Model
{
    protected $fillable = [
        'sub_model_id',
        'product_model',
        'attribute_name',
        'attribute_value',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function subModel(): BelongsTo
    {
        return $this->belongsTo(SubModel::class, 'sub_model_id');
    }
}
