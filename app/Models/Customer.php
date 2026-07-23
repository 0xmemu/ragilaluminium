<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'email',
        'default_address_line1',
        'default_address_line2',
        'default_city',
        'default_province',
        'default_postal_code',
        'default_country',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
