<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CmsTestimonial extends Model
{
    public const SOURCES = ['shopee', 'whatsapp', 'website', 'other'];

    /** Marketplace / WhatsApp — section “Apa kata pelanggan kami” (screenshot saja). */
    public const MARKETPLACE_SOURCES = ['shopee', 'whatsapp'];

    public const SOURCE_LABELS = [
        'shopee' => 'Shopee',
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
        'image_urls',
        'published',
        'sort_order',
    ];

    protected $casts = [
        'published' => 'boolean',
        'sort_order' => 'integer',
        'rating' => 'integer',
        'product_id' => 'integer',
        'cms_page_id' => 'integer',
        'image_urls' => 'array',
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

    /** Screenshot wajib untuk section Apa kata pelanggan kami. */
    public function scopeWithScreenshot(Builder $query): Builder
    {
        return $query->whereNotNull('image_url')->where('image_url', '!=', '');
    }

    public function scopeWebsite(Builder $query): Builder
    {
        return $query->where('source', 'website');
    }

    public static function sourceLabel(string $source): string
    {
        return self::SOURCE_LABELS[$source] ?? $source;
    }

    /**
     * Daftar foto ulasan — multi-gambar (image_urls) dengan fallback ke image_url tunggal.
     *
     * @return list<string>
     */
    public function imagesPayload(): array
    {
        $primary = is_string($this->image_url) && $this->image_url !== '' ? $this->image_url : null;
        $extra = is_array($this->image_urls)
            ? array_values(array_filter(array_map(
                fn ($url) => is_string($url) ? trim($url) : '',
                $this->image_urls,
            )))
            : [];

        return array_values(array_unique(array_filter([$primary, ...$extra])));
    }

    /** Public storefront payload (PDP + /reviews + home). */
    public function toPublicArray(bool $includeProduct = true): array
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
            'images' => $this->imagesPayload(),
            'product' => $includeProduct && $product ? [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $product->short_name ?: $product->name,
                'href' => route('product.show', $product->parent_sku, absolute: false),
            ] : null,
        ];
    }
}
