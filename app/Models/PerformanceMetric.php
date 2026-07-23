<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceMetric extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'metric_date',
        'metric_name',
        'metric_value',
        'context',
        'created_at',
    ];

    protected $casts = [
        'metric_date' => 'date',
        'metric_value' => 'decimal:4',
        'context' => 'array',
        'created_at' => 'datetime',
    ];
}
