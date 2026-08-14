<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Riwayat transisi status pemrosesan media (pending -> ready / failed).
 * Polimorfik: menunjuk ke MediaAsset (upload langsung) atau ProductMedia.
 */
class MediaProcessingLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'loggable_type',
        'loggable_id',
        'entity_label',
        'event',
        'message',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function loggable(): MorphTo
    {
        return $this->morphTo();
    }

    /** Catat satu transisi status. */
    public static function record(
        Model $loggable,
        string $event,
        ?string $message = null,
    ): self {
        return static::create([
            'loggable_type' => $loggable->getMorphClass(),
            'loggable_id' => $loggable->getKey(),
            'entity_label' => static::labelFor($loggable),
            'event' => $event,
            'message' => $message,
            'created_at' => now(),
        ]);
    }

    private static function labelFor(Model $loggable): string
    {
        if ($loggable instanceof MediaAsset) {
            return $loggable->label ?: ('Aset #'.$loggable->id);
        }

        if ($loggable instanceof ProductMedia) {
            $name = $loggable->product?->name;

            return $name ? ('Media: '.$name) : ('Media #'.$loggable->id);
        }

        return class_basename($loggable).' #'.$loggable->getKey();
    }
}
