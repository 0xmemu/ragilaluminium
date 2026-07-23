<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id',
        'variant_sku',
        'variation_1_name',
        'variation_1_option',
        'variation_2_name',
        'variation_2_option',
        'price',
        'stock',
        'weight_kg',
        'width_cm',
        'height_cm',
        'depth_cm',
        'status',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'weight_kg' => 'decimal:3',
        'width_cm' => 'decimal:2',
        'height_cm' => 'decimal:2',
        'depth_cm' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function attributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * Schema-shaped API representation (database-schema.md: product_variants).
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'variant_sku' => $this->variant_sku,
            'variation_1_name' => $this->variation_1_name,
            'variation_1_option' => $this->variation_1_option,
            'variation_2_name' => $this->variation_2_name,
            'variation_2_option' => $this->variation_2_option,
            'price' => $this->price,
            'stock' => $this->stock,
            'weight_kg' => $this->weight_kg,
            'width_cm' => $this->width_cm,
            'height_cm' => $this->height_cm,
            'depth_cm' => $this->depth_cm,
            'status' => $this->status,
            'in_stock' => $this->in_stock,
            'attributes' => $this->relationLoaded('attributes')
                ? $this->getRelation('attributes')->map(fn ($a) => [
                    'attribute_name' => $a->attribute_name,
                    'attribute_value' => $a->attribute_value,
                ])->all()
                : [],
        ];
    }

    public function getInStockAttribute(): bool
    {
        return $this->stock > 0;
    }
}
