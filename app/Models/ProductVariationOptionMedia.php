<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu gambar untuk satu NILAI OPSI variasi (mis. Warna = Putih).
 *
 * Tidak terhubung ke product_variants: gambar opsi harus tetap sama untuk
 * semua kombinasi yang memuat opsi itu, sehingga memilih sumbu lain tidak
 * pernah menimpa gambar.
 */
class ProductVariationOptionMedia extends Model
{
    protected $fillable = [
        'product_id',
        'variation_slot',
        'variation_name',
        'option_value',
        'media_asset_id',
        'source_url',
        'sort_order',
        'created_by_import_job_id',
    ];

    protected $casts = [
        'variation_slot' => 'integer',
        'sort_order' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class);
    }
}
