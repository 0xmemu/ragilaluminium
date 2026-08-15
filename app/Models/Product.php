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
        'popularity_seed',
        'popularity_seed_source_product_id',
        'popularity_seed_applied_at',
        'popularity_seed_applied_by_user_id',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'homepage_popular' => 'boolean',
        'homepage_popular_sort' => 'integer',
        'popularity_seed' => 'integer',
        'popularity_seed_applied_at' => 'datetime',
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
        return $this->hasMany(ProductMedia::class)->with('mediaAsset');
    }

    public function installationMedia(): HasMany
    {
        return $this->hasMany(ProductMedia::class)->installation();
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** Order items that represent valid website demand for commercial ranking. */
    public function validOrderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class)
            ->whereHas('order', fn ($query) => $query->whereIn('order_status', [
                'processing',
                'shipped',
                'delivered',
                'completed',
            ]));
    }

    /** Manual ulasan (Shopee/WA/dll) linked to this product for PDP. */
    public function testimonials(): HasMany
    {
        return $this->hasMany(CmsTestimonial::class);
    }

    public function popularityBoostsAsSource(): HasMany
    {
        return $this->hasMany(ProductPopularityBoost::class, 'source_product_id');
    }

    public function popularityBoostsAsTarget(): HasMany
    {
        return $this->hasMany(ProductPopularityBoost::class, 'target_product_id');
    }

    public function mainImage()
    {
        return $this->hasOne(ProductMedia::class)
            ->with('mediaAsset')
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
        return $query->where('status', 'active')->whereHas('activeVariants');
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

    /** Rank by valid website sales plus an explicit popularity seed. */
    public function scopeWithPopularityScore(Builder $query): Builder
    {
        return $query->withSum('validOrderItems as sold_count', 'quantity');
    }

    public function scopeOrderByPopularity(Builder $query): Builder
    {
        return $query
            ->withPopularityScore()
            ->orderByRaw('(COALESCE(products.popularity_seed, 0) + COALESCE(sold_count, 0)) DESC');
    }

    /** Rank by website sales plus popularity seed (catalog / related products). */
    public function scopeOrderByWebsiteSales(Builder $query): Builder
    {
        return $query->orderByPopularity()->orderByDesc('id');
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
                        'kind' => $m->mediaAsset?->kind ?? (str_starts_with((string) $m->mime_type, 'video/') ? 'video' : 'image'),
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
                            'video' => $m->urlFor('video'),
                        ],
                        'status' => $m->status,
                    ])->values()->all()
                : [],
            'installation_media' => $this->relationLoaded('installationMedia')
                ? $this->getRelation('installationMedia')
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
                : ($this->relationLoaded('media')
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
                    : []),
        ];
    }
}
