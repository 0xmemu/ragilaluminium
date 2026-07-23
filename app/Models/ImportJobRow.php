<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportJobRow extends Model
{
    protected $fillable = [
        'import_job_id',
        'row_number',
        'raw_data',
        'status',
        'error_reason',
        'linked_product_id',
        'linked_product_variant_id',
        'processed_at',
    ];

    protected $casts = [
        'row_number' => 'integer',
        'raw_data' => 'array',
        'processed_at' => 'datetime',
    ];

    public function importJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class);
    }

    public function linkedProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function linkedProductVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }
}
