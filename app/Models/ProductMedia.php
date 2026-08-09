<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ProductMedia extends Model
{
    protected $fillable = [
        'product_id',
        'product_variant_id',
        'media_asset_id',
        'position',
        'is_main_image',
        'show_in_catalog',
        'is_installation',
        'installation_caption',
        'visibility',
        'source_url',
        'stored_path',
        'stored_url',
        'derivatives',
        'mime_type',
        'size_bytes',
        'width_px',
        'height_px',
        'status',
        'error_reason',
        'created_by_import_job_id',
        'last_updated_by_import_job_id',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'is_main_image' => 'boolean',
        'show_in_catalog' => 'boolean',
        'is_installation' => 'boolean',
        'position' => 'integer',
        'size_bytes' => 'integer',
        'width_px' => 'integer',
        'height_px' => 'integer',
        'derivatives' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class);
    }

    public function createdByImportJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'created_by_import_job_id');
    }

    public function lastUpdatedByImportJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'last_updated_by_import_job_id');
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('visibility', 'visible');
    }

    public function scopeCatalog(Builder $query): Builder
    {
        return $query->where('show_in_catalog', true);
    }

    public function scopeInstallation(Builder $query): Builder
    {
        return $query->where('is_installation', true);
    }

    /**
     * Local stored/derivative URL only (no remote source_url fallback).
     * Prefers disk path → live URL so APP_URL / host changes do not break storefront images.
     */
    public function localUrlFor(string $variant = 'card'): ?string
    {
        if ($this->relationLoaded('mediaAsset') && $this->mediaAsset) {
            return $this->mediaAsset->urlFor($variant);
        }

        $variant = in_array($variant, ['thumb', 'card', 'pdp', 'video'], true) ? $variant : 'card';

        $derivatives = $this->derivatives ?? [];
        if (! empty($derivatives[$variant]['path'])) {
            return $this->publicUrlForPath((string) $derivatives[$variant]['path']);
        }

        foreach (['card', 'pdp', 'thumb'] as $fallback) {
            if ($fallback !== $variant && ! empty($derivatives[$fallback]['path'])) {
                return $this->publicUrlForPath((string) $derivatives[$fallback]['path']);
            }
        }

        if ($this->status === 'downloaded' && $this->stored_path) {
            return $this->publicUrlForPath((string) $this->stored_path);
        }

        if (! empty($derivatives[$variant]['url'])) {
            return $this->normalizePublicUrl((string) $derivatives[$variant]['url']);
        }

        foreach (['card', 'pdp', 'thumb'] as $fallback) {
            if ($fallback !== $variant && ! empty($derivatives[$fallback]['url'])) {
                return $this->normalizePublicUrl((string) $derivatives[$fallback]['url']);
            }
        }

        if ($this->status === 'downloaded' && $this->stored_url) {
            return $this->normalizePublicUrl((string) $this->stored_url);
        }

        return null;
    }

    /**
     * Build a browser-usable URL from a media disk path.
     * Prefer root-relative paths (`/media-cdn/...`, `/storage/...`) so cards work
     * on both the Cloudflare host and http://VPS_IP:8200.
     */
    public function publicUrlForPath(string $path): string
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $url = $disk->url(ltrim($path, '/'));

        return $this->normalizePublicUrl($url);
    }

    protected function normalizePublicUrl(string $url): string
    {
        $url = $this->rewriteR2DevToAppProxy($url);

        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            return $url;
        }

        // Same-origin media proxy and local disk — root-relative for any host/scheme.
        if (str_starts_with($path, '/media-cdn/') || str_starts_with($path, '/storage/')) {
            return $path;
        }

        return $url;
    }

    /**
     * Map legacy *.r2.dev object URLs onto the same-origin /media-cdn proxy
     * (nginx → R2) so storefront images work when r2.dev is throttled/blocked.
     */
    protected function rewriteR2DevToAppProxy(string $url): string
    {
        $legacy = rtrim((string) env('MEDIA_LEGACY_PUBLIC_URL', ''), '/');
        $proxyBase = rtrim((string) config('filesystems.disks.media.proxy_url', ''), '/');

        if ($legacy === '' || $proxyBase === '' || ! str_starts_with($url, $legacy.'/')) {
            return $url;
        }

        if (str_starts_with($url, $legacy.'/')) {
            $suffix = substr($url, strlen($legacy));
            $proxyPath = parse_url($proxyBase, PHP_URL_PATH) ?: '/media-cdn';

            return rtrim($proxyPath, '/').$suffix;
        }

        return $url;
    }

    /**
     * Public URL for a derivative size (thumb|card|pdp), or original, never Shopee in prod.
     */
    public function urlFor(string $variant = 'card'): ?string
    {
        $local = $this->localUrlFor($variant);
        if ($local) {
            return $local;
        }

        if (config('media.allow_source_url_fallback') && $this->source_url) {
            return $this->source_url;
        }

        return null;
    }

    public function getDisplayUrlAttribute(): ?string
    {
        return $this->urlFor('card');
    }

    public function srcsetForCard(): ?string
    {
        $thumb = $this->urlFor('thumb');
        $card = $this->urlFor('card');
        if (! $thumb && ! $card) {
            return null;
        }

        $parts = [];
        if ($thumb) {
            $w = data_get($this->derivatives, 'thumb.width', 400);
            $parts[] = "{$thumb} {$w}w";
        }
        if ($card) {
            $w = data_get($this->derivatives, 'card.width', 800);
            $parts[] = "{$card} {$w}w";
        }

        return implode(', ', $parts);
    }
}
