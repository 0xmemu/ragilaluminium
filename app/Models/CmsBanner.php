<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CmsBanner extends Model
{
    protected $fillable = [
        'title',
        'image_url',
        'link_url',
        'sort_order',
        'published',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'published' => 'boolean',
    ];

    public function scopePublished($query)
    {
        return $query->where('published', true)->orderBy('sort_order');
    }
}
