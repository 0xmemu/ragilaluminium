<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubModel extends Model
{
    protected $fillable = [
        'product_model',
        'code',
        'name',
        'description',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Bersihkan cache taksonomi setiap sub model berubah.
     *
     * Sebelum 16 Okt 2026 cache `catalog.sub_model_codes.*` hanya dibersihkan di
     * metode destroy controller, sehingga sub model yang BARU DIBUAT atau
     * DINONAKTIFKAN tidak langsung terlihat (menunggu TTL 1 jam). Akibatnya
     * dropdown pencarian dan pilihan sub model bisa basi. Hook ini menaruh
     * pembersihan di level model supaya berlaku untuk SEMUA jalur yang menulis
     * sub model, bukan hanya satu controller.
     */
    protected static function booted(): void
    {
        $flush = function (self $model): void {
            \Illuminate\Support\Facades\Cache::forget('catalog.sub_model_codes.all');
            \Illuminate\Support\Facades\Cache::forget('catalog.sub_model_codes.'.($model->product_model ?? ''));
            \Illuminate\Support\Facades\Cache::forget('catalog.model_codes.v4.all');
            \Illuminate\Support\Facades\Cache::forget('catalog.model_codes.v3.all');
            if ($model->product_model) {
                \Illuminate\Support\Facades\Cache::forget(
                    'catalog.model_codes.v4.'.strtoupper((string) $model->product_model)
                );
                \Illuminate\Support\Facades\Cache::forget(
                    'catalog.model_codes.v3.'.strtoupper((string) $model->product_model)
                );
            }
            \App\Support\CatalogTaxonomy::forgetCache();
        };

        static::saved($flush);
        static::deleted($flush);
    }

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
