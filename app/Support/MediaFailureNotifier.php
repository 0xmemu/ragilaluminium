<?php

namespace App\Support;

use App\Models\AdminNotification;
use App\Models\MediaAsset;
use App\Models\ProductMedia;
use Illuminate\Database\Eloquent\Model;

/**
 * Notifikasi admin otomatis saat job pemrosesan media gagal.
 * Dedupe: hanya satu notifikasi belum dibaca per entitas media —
 * kegagalan berulang (retry) memperbarui notifikasi lama, tidak menumpuk.
 */
class MediaFailureNotifier
{
    public static function notify(Model $loggable, string $reason): void
    {
        $label = static::labelFor($loggable);
        $type = $loggable instanceof ProductMedia ? ProductMedia::class : MediaAsset::class;
        $id = (int) $loggable->getKey();

        $existing = AdminNotification::query()
            ->where('type', 'media_failed')
            ->where('related_type', $type)
            ->where('related_id', $id)
            ->whereNull('read_at')
            ->latest('id')
            ->first();

        if ($existing) {
            $existing->update([
                'title' => 'Media gagal diproses',
                'body' => "{$label}: ".mb_substr($reason, 0, 400),
                'href' => route('admin.media.history', ['event' => 'failed']),
            ]);

            return;
        }

        AdminNotification::create([
            'type' => 'media_failed',
            'related_type' => $type,
            'related_id' => $id,
            'title' => 'Media gagal diproses',
            'body' => "{$label}: ".mb_substr($reason, 0, 400),
            'href' => route('admin.media.history', ['event' => 'failed']),
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
