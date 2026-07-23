<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CmsPage extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'content',
        'published',
        'updated_by_admin_id',
    ];

    protected $casts = [
        'content' => 'array',
        'published' => 'boolean',
    ];

    public function updatedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_admin_id');
    }

    public function faqItems(): HasMany
    {
        return $this->hasMany(CmsFaqItem::class);
    }

    public function problemsSolutions(): HasMany
    {
        return $this->hasMany(CmsProblemSolution::class);
    }

    public function galleryItems(): HasMany
    {
        return $this->hasMany(CmsGalleryItem::class);
    }

    public function testimonials(): HasMany
    {
        return $this->hasMany(CmsTestimonial::class);
    }

    public function scopePublished($query)
    {
        return $query->where('published', true);
    }
}
