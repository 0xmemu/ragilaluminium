<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CmsModelProduct extends Model
{
    public const STATUSES = ['active', 'draft'];

    /** Batas jumlah foto galeri per model (hero halaman detail model). */
    public const MAX_GALLERY = 8;

    protected $fillable = [
        'name',
        'product_category',
        'product_model',
        'image_url',
        'media_asset_id',
        'media_show_product_photos',
        'description',
        'keywords',
        'status',
        'sort_order',
    ];

    protected static function booted(): void
    {
        $flush = function (self $model) {
            \Illuminate\Support\Facades\Cache::forget('catalog.model_codes.v3.all');
            \Illuminate\Support\Facades\Cache::forget('catalog.model_codes');
            \Illuminate\Support\Facades\Cache::forget('catalog.model_codes.v2');
            if ($model->product_category) {
                \Illuminate\Support\Facades\Cache::forget('catalog.model_codes.v3.'.strtoupper((string) $model->product_category));
            }
            if ($model->product_model) {
                \Illuminate\Support\Facades\Cache::forget('catalog.model.label.'.strtolower((string) $model->product_model));
            }
            \App\Support\CatalogTaxonomy::forgetCache();
        };

        static::saved($flush);
        static::deleted($flush);
    }

    protected $casts = [
        'sort_order' => 'integer',
        'keywords' => 'array',
        'media_show_product_photos' => 'boolean',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active')->orderBy('sort_order')->orderBy('id');
    }

    /** Gambar utama model (Media Library). Null = pakai fallback kolom image_url. */
    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    /** Galeri foto model, urut sesuai sort_order pivot. */
    public function galleryAssets(): BelongsToMany
    {
        return $this->belongsToMany(
            MediaAsset::class,
            'cms_model_product_media',
            'cms_model_product_id',
            'media_asset_id',
        )
            ->withPivot('sort_order')
            ->withTimestamps()
            ->orderBy('cms_model_product_media.sort_order')
            ->orderBy('cms_model_product_media.id');
    }

    /**
     * Gambar utama siap pakai: utamakan media asset (WebP + varian ukuran),
     * jatuh ke kolom image_url untuk data legacy/snapshot.
     */
    public function resolvedImage(string $variant = 'card'): ?string
    {
        $url = $this->mediaAsset?->localUrlFor($variant);

        return $url ?: ($this->image_url ?: null);
    }

    /** @return list<array{id: int, url: ?string, label: ?string, kind: string}> */
    public function galleryPayload(string $variant = 'pdp'): array
    {
        return $this->galleryAssets
            ->map(fn (MediaAsset $asset) => [
                'id' => (int) $asset->id,
                'url' => $asset->localUrlFor($variant) ?: $asset->localUrlFor('card'),
                'label' => $asset->label,
                'kind' => (string) $asset->kind,
            ])
            ->values()
            ->all();
    }
}
