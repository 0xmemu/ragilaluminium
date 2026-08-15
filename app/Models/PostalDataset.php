<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PostalDataset extends Model
{
    protected $fillable = [
        'source', 'version', 'source_url', 'reference_source', 'reference_url',
        'published_at', 'retrieved_at', 'checksum_sha256', 'status', 'row_count', 'notes',
    ];

    protected $casts = [
        'published_at' => 'date',
        'retrieved_at' => 'datetime',
        'row_count' => 'integer',
    ];

    public function mappings(): HasMany
    {
        return $this->hasMany(PostalCodeMapping::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }
}
