<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubModel extends Model
{
    public const MODELS = ['JUNGKIT', 'SLIDING', 'SWING', 'KACA_MATI', 'ZIGZAG'];

    protected $fillable = [
        'product_model',
        'code',
        'name',
        'description',
        'image_url',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForModel(Builder $query, string $productModel): Builder
    {
        return $query->where('product_model', $productModel);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'design_variant', 'code')
            ->whereColumn('products.product_model', 'sub_models.product_model');
    }
}
