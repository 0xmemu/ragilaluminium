<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceVisitorEvent extends Model
{
    protected $fillable = [
        'visitor_hash',
        'visit_date',
        'visited_at',
    ];

    protected $casts = [
        'visit_date' => 'date',
        'visited_at' => 'datetime',
    ];
}
