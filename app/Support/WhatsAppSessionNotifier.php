<?php

namespace App\Support;

use App\Models\AdminNotification;
use App\Models\EventLog;

/**
 * Notifikasi admin otomatis saat sesi WhatsApp gateway berubah (Baileys).
 * Dedupe: hanya satu notifikasi belum dibaca per jenis — kejadian berulang
 * (mis. logout berulang) memperbarui notifikasi lama, tidak menumpuk.
 */
class WhatsAppSessionNotifier
{
    public static function notifyLoggedOut(): void
    {
        $title = 'WhatsApp terputus — sesi logout';
        $body = 'Sesi gateway WhatsApp di-logout server. Scan ulang QR di halaman Pairing untuk menghubungkan kembali.';
        $href = route('admin.whatsapp.pairing');

        $existing = AdminNotification::query()
            ->where('type', 'whatsapp_logged_out')
            ->whereNull('read_at')
            ->latest('id')
            ->first();

        if ($existing) {
            $existing->update([
                'title' => $title,
                'body' => $body,
                'href' => $href,
            ]);

            return;
        }

        AdminNotification::create([
            'type' => 'whatsapp_logged_out',
            'title' => $title,
            'body' => $body,
            'href' => $href,
        ]);

        // Audit trail event_logs (append-only) untuk traceability.
        EventLog::create([
            'event_type' => 'whatsapp.logged_out',
            'entity_type' => 'whatsapp_gateway',
            'entity_id' => 1,
            'payload' => ['source' => 'webhook_session_status'],
            'created_at' => now(),
        ]);
    }
}