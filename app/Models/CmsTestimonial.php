<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CmsTestimonial extends Model
{
    public const SOURCES = ['shopee', 'whatsapp', 'website', 'other'];

    /** Marketplace / WhatsApp / other — section “Apa kata pelanggan kami”. */
    public const MARKETPLACE_SOURCES = ['shopee', 'whatsapp', 'other'];

    public const SOURCE_LABELS = [
        'shopee' => 'Marketplace / Shopee',
        'whatsapp' => 'WhatsApp',
        'website' => 'Website',
        'other' => 'Lainnya',
    ];

    protected $fillable = [
        'cms_page_id',
        'product_id',
        'customer_name',
        'message',
        'rating',
        'source',
        'location',
        'image_url',
        'published',
        'sort_order',
    ];

    protected $casts = [
        'published' => 'boolean',
        'sort_order' => 'integer',
        'rating' => 'integer',
        'product_id' => 'integer',
        'cms_page_id' => 'integer',
    ];

    public function cmsPage(): BelongsTo
    {
        return $this->belongsTo(CmsPage::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('published', true);
    }

    public function scopeForProduct(Builder $query, int $productId): Builder
    {
        return $query->where('product_id', $productId);
    }

    public function scopeMarketplace(Builder $query): Builder
    {
        return $query->whereIn('source', self::MARKETPLACE_SOURCES);
    }

    public function scopeWebsite(Builder $query): Builder
    {
        return $query->where('source', 'website');
    }

    public static function sourceLabel(string $source): string
    {
        return self::SOURCE_LABELS[$source] ?? $source;
    }

    /** Public storefront payload (PDP + /reviews + home). */
    public function toPublicArray(): array
    {
        $product = $this->relationLoaded('product') ? $this->product : null;

        return [
            'id' => $this->id,
            'customer_name' => $this->customer_name,
            'message' => $this->message,
            'rating' => $this->rating,
            'source' => $this->source,
            'location' => $this->location,
            'image_url' => $this->image_url,
            'product' => $product ? [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $product->short_name ?: $product->name,
                'href' => route('product.show', $product->parent_sku, absolute: false),
            ] : null,
        ];
    }
}
