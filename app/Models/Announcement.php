<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    protected $fillable = [
        'text',
        'href',
        'starts_at',
        'ends_at',
        'sort_order',
        'published',
    ];

    protected $casts = [
        'starts_at' => 'date',
        'ends_at' => 'date',
        'sort_order' => 'integer',
        'published' => 'boolean',
    ];

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('published', true);
    }

    public function scopeActive(Builder $query, ?Carbon $now = null): Builder
    {
        $now ??= Carbon::now();

        return $query
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhereDate('starts_at', '<=', $now))
            ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhereDate('ends_at', '>=', $now));
    }
}
