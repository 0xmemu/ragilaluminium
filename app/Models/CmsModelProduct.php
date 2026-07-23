<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CmsModelProduct extends Model
{
    public const TYPES = ['polos', 'ornamen', 'lainnya'];

    public const STATUSES = ['active', 'draft'];

    protected $fillable = [
        'name',
        'product_category',
        'product_model',
        'image_url',
        'type',
        'status',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active')->orderBy('sort_order')->orderBy('id');
    }
}
