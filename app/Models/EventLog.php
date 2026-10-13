<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class EventLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'event_type',
        'entity_type',
        'entity_id',
        'payload',
        'created_by_user_id',
        'created_at',
        'source',
        'before',
        'after',
        'reason',
        'reference_type',
        'reference_id',
    ];

    protected $casts = [
        'payload' => 'array',
        'before' => 'array',
        'after' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException("Event logs are append-only and cannot be updated.");
        });

        static::deleting(function (): void {
            throw new LogicException("Event logs are append-only and cannot be deleted.");
        });
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
