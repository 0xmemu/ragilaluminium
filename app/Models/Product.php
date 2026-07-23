<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'parent_sku',
        'name',
        'short_name',
        'description',
        'category_id',
        'product_category',
        'product_model',
        'design_variant',
        'status',
        'homepage_popular',
        'homepage_popular_sort',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'homepage_popular' => 'boolean',
        'homepage_popular_sort' => 'integer',
    ];

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function activeVariants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->where('status', 'active');
    }

    public function attributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class);
    }

    public function installationMedia(): HasMany
    {
        return $this->hasMany(ProductMedia::class)->installation();
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** Manual ulasan (Shopee/WA/dll) linked to this product for PDP. */
    public function testimonials(): HasMany
    {
        return $this->hasMany(CmsTestimonial::class);
    }

    public function mainImage()
    {
        return $this->hasOne(ProductMedia::class)
            ->where('is_main_image', true)
            ->where('show_in_catalog', true)
            ->where('visibility', 'visible')
            ->oldestOfMany('position');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeCategory(Builder $query, string $category): Builder
    {
        return $query->where('product_category', $category);
    }

    /** Admin-curated picks for Home “Paling Banyak Dipesan”. */
    public function scopeHomepagePopular(Builder $query): Builder
    {
        return $query->where('homepage_popular', true);
    }

    /** Rank by website order quantity (catalog Terlaris / fallback Home). */
    public function scopeOrderByWebsiteSales(Builder $query): Builder
    {
        return $query
            ->withSum('orderItems as sold_count', 'quantity')
            ->orderByDesc('sold_count')
            ->orderByDesc('id');
    }

    public function getMinPriceAttribute(): ?float
    {
        return $this->relationLoaded('activeVariants')
            ? $this->activeVariants->min('price')
            : $this->activeVariants()->min('price');
    }

    /**
     * Schema-shaped API representation (database-schema.md: products + relations).
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'parent_sku' => $this->parent_sku,
            'name' => $this->name,
            'short_name' => $this->short_name,
            'description' => $this->description,
            'category_id' => $this->category_id,
            'product_category' => $this->product_category,
            'product_model' => $this->product_model,
            'design_variant' => $this->design_variant,
            'status' => $this->status,
            'min_price' => $this->min_price,
            'main_image' => $this->relationLoaded('mainImage') ? ($this->mainImage?->urlFor('card')) : null,
            'variants' => $this->relationLoaded('activeVariants')
                ? $this->activeVariants->map(fn ($v) => $v->toApiArray())->all()
                : [],
            'attributes' => $this->relationLoaded('attributes')
                ? $this->getRelation('attributes')->map(fn ($a) => [
                    'attribute_name' => $a->attribute_name,
                    'attribute_value' => $a->attribute_value,
                ])->all()
                : [],
            'media' => $this->relationLoaded('media')
                ? $this->media
                    ->filter(fn ($m) => $m->show_in_catalog)
                    ->map(fn ($m) => [
                        'id' => $m->id,
                        'position' => $m->position,
                        'is_main_image' => $m->is_main_image,
                        'is_installation' => (bool) $m->is_installation,
                        'show_in_catalog' => (bool) $m->show_in_catalog,
                        'visibility' => $m->visibility,
                        'stored_url' => $m->stored_url,
                        'display_url' => $m->display_url,
                        'urls' => [
                            'thumb' => $m->urlFor('thumb'),
                            'card' => $m->urlFor('card'),
                            'pdp' => $m->urlFor('pdp'),
                        ],
                        'status' => $m->status,
                    ])->values()->all()
                : [],
            'installation_media' => $this->relationLoaded('media')
                ? $this->media
                    ->filter(fn ($m) => $m->is_installation)
                    ->map(fn ($m) => [
                        'id' => $m->id,
                        'position' => $m->position,
                        'display_url' => $m->display_url,
                        'urls' => [
                            'thumb' => $m->urlFor('thumb'),
                            'card' => $m->urlFor('card'),
                            'pdp' => $m->urlFor('pdp'),
                        ],
                        'status' => $m->status,
                    ])->values()->all()
                : [],
        ];
    }
}
