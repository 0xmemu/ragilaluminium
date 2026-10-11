<?php

namespace App\Support;

use App\Models\AdminNotification;
use App\Models\WhatsAppMessage;

/**
 * Notifikasi admin otomatis saat pengiriman pesan WhatsApp gagal.
 *
 * Dulu kegagalan kirim tidak memberi tahu siapa pun: admin baru tahu setelah
 * membuka halaman WhatsApp dan menemukan tumpukan pesan gagal. Akibatnya
 * kegagalan bisa menumpuk berhari-hari tanpa ada yang menangani.
 *
 * Dedupe: hanya SATU notifikasi belum dibaca untuk seluruh kegagalan kirim.
 * Kegagalan berulang (mis. sesi gateway putus dan banyak pesan ikut gagal)
 * memperbarui notifikasi yang sama, bukan menumpuk, karena satu sebab biasanya
 * melahirkan banyak kegagalan sekaligus. Isinya jumlah pesan yang masih
 * menunggu tindakan supaya admin tahu skalanya.
 */
class WhatsAppSendFailureNotifier
{
    /**
     * Catat kegagalan kirim satu pesan.
     *
     * @param  string|null  $reason  Alasan dari gateway, apa adanya (dinormalkan
     *                               jadi kalimat Indonesia sebelum ditampilkan).
     */
    public static function notify(?string $reason): void
    {
        $sebab = WhatsAppFailureReason::describe($reason) ?? 'alasan tidak tercatat dari gateway';
        $menunggu = WhatsAppMessage::query()
            ->where('status', 'failed')
            ->whereNull('raw_payload->superseded_by')
            ->count();

        $title = 'Pesan WhatsApp gagal terkirim';
        $body = $menunggu.' pesan menunggu dikirim ulang. Terakhir: '.$sebab;
        $href = route('admin.whatsapp.dashboard', ['status' => 'failed']);

        $existing = AdminNotification::query()
            ->where('type', 'whatsapp_send_failed')
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
            'type' => 'whatsapp_send_failed',
            'title' => $title,
            'body' => $body,
            'href' => $href,
        ]);
    }
}
