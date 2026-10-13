<?php

namespace App\Support;

use App\Models\AdminNotification;
use App\Models\ImportJob;

/**
 * Notifikasi admin otomatis saat job impor katalog/media gagal permanen.
 * Dedupe: satu notifikasi belum dibaca per job impor - kegagalan berulang
 * (retry) memperbarui notifikasi lama, tidak menumpuk.
 */
class ImportFailureNotifier
{
    public static function notify(int $importJobId, string $reason): void
    {
        $existing = AdminNotification::query()
            ->where('type', 'import_failed')
            ->where('related_type', ImportJob::class)
            ->where('related_id', $importJobId)
            ->whereNull('read_at')
            ->latest('id')
            ->first();

        $href = route('admin.imports.show', ['import_job' => $importJobId]);

        if ($existing) {
            $existing->update([
                'title' => 'Import gagal',
                'body' => mb_substr($reason, 0, 400),
                'href' => $href,
            ]);

            return;
        }

        AdminNotification::create([
            'type' => 'import_failed',
            'related_type' => ImportJob::class,
            'related_id' => $importJobId,
            'title' => 'Import gagal',
            'body' => mb_substr($reason, 0, 400),
            'href' => $href,
        ]);
    }
}
