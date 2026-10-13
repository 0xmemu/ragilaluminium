<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostalCodeMapping extends Model
{
    protected $fillable = [
        'postal_dataset_id', 'province_id', 'province_name', 'regency_id', 'regency_name',
        'district_id', 'district_name', 'village_id', 'village_name', 'postal_code', 'source_row',
    ];

    protected $casts = ['source_row' => 'integer'];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(PostalDataset::class, 'postal_dataset_id');
    }
}
