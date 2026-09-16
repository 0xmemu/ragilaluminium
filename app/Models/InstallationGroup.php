<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Grup hasil pemasangan mandiri (tanpa model produk & tanpa SKU).
 * Judul diisi admin di form "Buat grup baru".
 */
class InstallationGroup extends Model
{
    protected $fillable = ['title'];

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class, 'installation_group_id');
    }
}
