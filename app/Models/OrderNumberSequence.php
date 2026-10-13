<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderNumberSequence extends Model
{
    protected $fillable = [
        'sequence_key',
        'seq',
    ];

    protected $casts = [
        'seq' => 'integer',
    ];
}

