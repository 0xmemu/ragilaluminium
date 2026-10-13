<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemHealthSnapshot extends Model
{
    protected $fillable = [
        'taken_at',
        'load_1', 'load_5', 'load_15',
        'cpu_pct', 'vcpu',
        'memory_used_mb', 'memory_total_mb', 'memory_pct',
        'disk_used_gb', 'disk_total_gb', 'disk_pct', 'disk_mount',
        'db_response_ms', 'queue_backlog',
        'php_memory_mb', 'php_peak_mb',
    ];

    protected $casts = [
        'taken_at' => 'datetime',
        'vcpu' => 'integer',
        'queue_backlog' => 'integer',
    ];
}
