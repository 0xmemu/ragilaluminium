<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CmsTestimonial extends Model
{
    public const SOURCES = ['shopee', 'whatsapp', 'website', 'other'];
    public const MARKETPLACE_SOURCES = ['shopee', 'whatsapp'];
    public const AUTHOR_TYPES = ['customer', 'admin'];
    public const MODERATION_STATUSES = ['pending', 'approved', 'rejected'];
    public const SOURCE_LABELS = [
        'shopee' => 'Shopee', 'whatsapp' => 'WhatsApp', 'website' => 'Website', 'other' => 'Lainnya',
    ];

    protected $fillable = [
        'cms_page_id', 'product_id', 'order_id', 'author_admin_id', 'author_type', 'moderation_status',
        'verified_at', 'customer_name', 'message', 'rating', 'source', 'source_reference', 'location',
        'image_url', 'image_urls', 'media_items', 'published', 'sort_order',
    ];

    protected $casts = [
        'published' => 'boolean', 'sort_order' => 'integer', 'rating' => 'integer', 'product_id' => 'integer',
        'cms_page_id' => 'integer', 'order_id' => 'integer', 'author_admin_id' => 'integer',
        'image_urls' => 'array', 'media_items' => 'array', 'verified_at' => 'datetime',
    ];

    public function cmsPage(): BelongsTo { return $this->belongsTo(CmsPage::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function authorAdmin(): BelongsTo { return $this->belongsTo(User::class, 'author_admin_id'); }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('published', true)->where('moderation_status', 'approved');
    }
    public function scopeForProduct(Builder $query, int $productId): Builder { return $query->where('product_id', $productId); }
    public function scopeMarketplace(Builder $query): Builder { return $query->whereIn('source', self::MARKETPLACE_SOURCES); }
    public function scopeWithScreenshot(Builder $query): Builder { return $query->whereNotNull('image_url')->where('image_url', '!=', ''); }
    public function scopeWebsite(Builder $query): Builder { return $query->where('source', 'website'); }
    public function scopeVerified(Builder $query): Builder { return $query->whereNotNull('verified_at'); }

    public static function sourceLabel(string $source): string { return self::SOURCE_LABELS[$source] ?? $source; }
    public function isCustomerAuthored(): bool { return ($this->author_type ?: 'customer') === 'customer'; }
    public function isAdminAuthored(): bool { return ($this->author_type ?: 'customer') === 'admin'; }

    /** @return list<string> */
    public function imagesPayload(): array
    {
        $legacy = array_filter(array_map(fn ($url) => is_string($url) ? trim($url) : '', is_array($this->image_urls) ? $this->image_urls : []));
        $media = is_array($this->media_items) ? array_values(array_filter(array_map(
            fn ($item) => is_array($item) && is_string($item['url'] ?? null) ? trim($item['url']) : '', $this->media_items,
        ))) : [];
        return array_values(array_unique(array_filter([$this->image_url, ...$legacy, ...$media])));
    }

    /** @return list<array{type:string,url:string,source:string}> */
    public function mediaPayload(): array
    {
        $items = is_array($this->media_items) ? $this->media_items : [];
        return array_values(array_filter(array_map(function ($item) {
            if (! is_array($item) || ! filled($item['url'] ?? null)) return null;
            return ['type' => in_array($item['type'] ?? 'image', ['image', 'video'], true) ? $item['type'] : 'image', 'url' => (string) $item['url'], 'source' => (string) ($item['source'] ?? 'admin')];
        }, $items)));
    }

    public function toPublicArray(bool $includeProduct = true): array
    {
        $product = $this->relationLoaded('product') ? $this->product : null;
        return [
            'id' => $this->id, 'customer_name' => $this->customer_name, 'message' => $this->message,
            'rating' => $this->rating, 'source' => $this->source, 'location' => $this->location,
            'image_url' => $this->image_url, 'images' => $this->imagesPayload(), 'media' => $this->mediaPayload(),
            'verified_purchase' => $this->verified_at !== null,
            'product' => $includeProduct && $product ? ['id' => $product->id, 'parent_sku' => $product->parent_sku, 'name' => $product->short_name ?: $product->name, 'href' => route('product.show', $product->parent_sku, absolute: false)] : null,
        ];
    }
}
