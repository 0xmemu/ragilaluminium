<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JntAddressMaster extends Model
{
    protected $fillable = [
        'province_name', 'city_name', 'area_name', 'town_name',
        'province_key', 'city_key', 'area_key', 'town_key', 'synced_at',
    ];

    protected $casts = ['synced_at' => 'datetime'];
}
