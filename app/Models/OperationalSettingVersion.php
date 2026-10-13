<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

class OperationalSettingVersion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'setting_key',
        'version',
        'value',
        'actor_id',
        'source',
        'reason',
        'reference_type',
        'reference_id',
        'created_at',
    ];

    protected $casts = [
        'value' => 'array',
        'version' => 'integer',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('Operational setting versions are immutable.');
        });

        static::deleting(function (): void {
            throw new LogicException('Operational setting versions are immutable.');
        });
    }
}
