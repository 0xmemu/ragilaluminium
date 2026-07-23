<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CmsProblemSolution extends Model
{
    protected $table = 'cms_problems_solutions';

    protected $fillable = [
        'cms_page_id',
        'problem',
        'solution',
        'sort_order',
    ];

    protected $casts = ['sort_order' => 'integer'];

    public function cmsPage(): BelongsTo
    {
        return $this->belongsTo(CmsPage::class);
    }
}
