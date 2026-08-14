<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CmsGalleryItem extends Model
{
    protected $fillable = [
        'cms_page_id',
        'image_url',
        'media_asset_id',
        'label',
        'published',
        'sort_order',
    ];

    protected $casts = ['published' => 'boolean', 'sort_order' => 'integer'];

    public function cmsPage(): BelongsTo
    {
        return $this->belongsTo(CmsPage::class);
    }

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class);
    }
}
