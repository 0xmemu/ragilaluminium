<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubModel extends Model
{
    public const MODELS = [
        'JUNGKIT_1_DAUN',
        'JUNGKIT_2_DAUN',
        'JUNGKIT_3_DAUN',
        'SLIDING_2_DAUN',
        'SWING_1_DAUN',
        'SWING_2_DAUN',
        'SWING_3_DAUN',
        'KACA_MATI',
        'ZIGZAG',
        'JUNGKIT',
        'SLIDING',
        'SWING',
    ];

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

    public function attributeTemplates(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(\App\Models\SubModelAttributeTemplate::class, 'sub_model_id');
    }
}
