<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportJob extends Model
{
    protected $fillable = [
        'type',
        'source_file_name',
        'source_file_path',
        'stock_mode',
        'manual_stock',
        'total_rows',
        'processed_rows',
        'success_rows',
        'failed_rows',
        'status',
        'started_at',
        'completed_at',
        'global_error_message',
        'triggered_by_user_id',
    ];

    protected $casts = [
        'total_rows' => 'integer',
        'processed_rows' => 'integer',
        'success_rows' => 'integer',
        'failed_rows' => 'integer',
        'manual_stock' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function rows(): HasMany
    {
        return $this->hasMany(ImportJobRow::class);
    }

    public function failedRows(): HasMany
    {
        return $this->hasMany(ImportJobRow::class)->where('status', 'failed');
    }

    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by_user_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class, 'created_by_import_job_id');
    }

    public function scopeRunning(Builder $query): Builder
    {
        return $query->whereIn('status', ['pending', 'running']);
    }
}
