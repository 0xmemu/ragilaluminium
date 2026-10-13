<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $fillable = [
        'code', 'name', 'slug', 'seo_title', 'seo_description', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Produk dalam kategori ini, dicocokkan lewat kode kategori.
     *
     * products.product_category menyimpan kode kategori (mis. JENDELA) yang
     * sama dengan categories.code. Inilah relasi aktif; kolom products.category_id
     * adalah kolom warisan ID kategori Shopee yang dipensiunkan (keputusan owner
     * 2026-09-03) dan tidak lagi ditulis.
     */
    public function products()
    {
        return $this->hasMany(Product::class, 'product_category', 'code');
    }
}
