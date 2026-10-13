<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Folder organisasi VIRTUAL untuk Media Library.
 *
 * Folder hanya metadata organisasi manusia; TIDAK mempengaruhi object_key /
 * public_url asset. Rename/move folder = update metadata semata.
 * "Inbox" adalah folder virtual (assets dengan folder_id NULL), tidak disimpan.
 */
class MediaFolder extends Model
{
    protected $fillable = ['parent_id', 'name', 'sort_order', 'archived_at'];

    protected $casts = [
        'archived_at' => 'datetime',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'folder_id');
    }
}