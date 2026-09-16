<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class InstallationProject extends Model
{
    use HasFactory;

    protected $table = 'installation_projects';

    protected $fillable = [
        'title',
        'slug',
        'category_label',
        'description',
        'status',
        'sort_order',
        'model_product_id',
        'product_id',
        'main_image_url',
        'main_image_asset_id',
        'main_video_url',
        'main_video_asset_id',
        'gallery_images',
        'specifications',
        'features',
    ];

    protected $casts = [
        'gallery_images' => 'array',
        'specifications' => 'array',
        'features' => 'array',
        'sort_order' => 'integer',
    ];

    public function modelProduct(): BelongsTo
    {
        return $this->belongsTo(CmsModelProduct::class, 'model_product_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function mainImageAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'main_image_asset_id');
    }

    public function mainVideoAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'main_video_asset_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderByDesc('id');
    }

    public function resolvedMainImage(string $variant = 'card'): ?string
    {
        return $this->mainImageAsset?->localUrlFor($variant) ?: ($this->main_image_url ?: null);
    }

    public function resolvedMainVideo(): ?string
    {
        return $this->mainVideoAsset?->original_url ?: ($this->main_video_url ?: null);
    }

    public static function generateUniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($title) ?: 'proyek-pemasangan';
        $slug = $baseSlug;
        $counter = 1;

        while (static::query()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where('slug', $slug)
            ->exists()
        ) {
            $counter++;
            $slug = "{$baseSlug}-{$counter}";
        }

        return $slug;
    }
}
