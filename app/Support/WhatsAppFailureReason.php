<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Ubah alasan gagal kirim dari gateway WhatsApp menjadi kalimat berbahasa
 * Indonesia yang bisa dibaca admin.
 *
 * Gateway Baileys menjawab kegagalan sebagai JSON mentah, mis.
 * {"error":"not connected","status":"disconnected"}. Teks itu dulu ditampilkan
 * apa adanya di tabel pesan gagal, notifikasi admin, dan pesan kirim ulang,
 * sehingga admin melihat dump JSON alih-alih penjelasan (owner 2026-10-11:
 * "pakai bahasa yang dinormalisasi").
 *
 * Penyimpanan tetap apa adanya untuk diagnosa; normalisasi dilakukan saat
 * tampil supaya baris lama pun ikut terbaca.
 */
class WhatsAppFailureReason
{
    /**
     * Kalimat alasan yang siap tampil, atau null bila tidak ada alasan.
     */
    public static function describe(?string $reason): ?string
    {
        $raw = trim((string) $reason);

        if ($raw === '') {
            return null;
        }

        $payload = json_decode($raw, true);
        if (is_array($payload)) {
            return self::fromGatewayPayload($payload);
        }

        if (self::looksLikeNetworkError($raw)) {
            return 'Tidak dapat menghubungi gateway, jaringan gagal atau waktu habis.';
        }

        // Kalimat yang sudah ditulis sistem dalam Bahasa Indonesia.
        if (str_starts_with($raw, 'Nomor tidak terdaftar WhatsApp')
            || (str_starts_with($raw, 'Provider ') && str_contains($raw, 'belum dikonfigurasi'))) {
            return self::tidy($raw);
        }

        // Galat tak dikenal: tetap tampilkan, tetapi sebagai satu baris bersih
        // supaya tidak muncul sebagai dump dan tidak memanjang di tabel.
        return self::tidy($raw);
    }

    /**
     * Terjemahan payload JSON gateway.
     *
     * @param  array<string, mixed>  $payload
     */
    private static function fromGatewayPayload(array $payload): string
    {
        $error = strtolower(trim((string) ($payload['error'] ?? '')));
        $status = strtoupper(trim((string) ($payload['status'] ?? '')));
        $message = trim((string) ($payload['message'] ?? ''));

        $notConnected = str_contains($error, 'not connected')
            || str_contains($error, 'not log')
            || in_array($status, ['DISCONNECTED', 'CONNECTING', 'SCAN_QR', 'CLOSE', 'TIMEOUT', 'CLOSED'], true);

        if ($notConnected) {
            // Status membedakan tiga keadaan yang tindakannya berbeda: masih
            // menyambung (tunggu), perlu pindai QR (sambungkan perangkat), dan
            // benar-benar putus (sambungkan ulang).
            // Kalimat dijaga pendek: kolom Alasan Gagal hanya memuat dua baris,
            // kalimat panjang tampil terpotong sehingga maksudnya hilang.
            // Rujukannya nama tab yang terlihat admin, yaitu Sambungkan Nomor.
            return match ($status) {
                'CONNECTING' => 'Gateway sedang menyambung ke WhatsApp, coba kirim ulang sebentar lagi.',
                'SCAN_QR' => 'Gateway menunggu pindai QR, buka tab Sambungkan Nomor.',
                'DISCONNECTED' => 'Gateway terputus dari WhatsApp, sambungkan ulang di tab Sambungkan Nomor.',
                default => 'Gateway belum tersambung ke WhatsApp, buka tab Sambungkan Nomor.',
            };
        }

        if ($message !== '') {
            return self::describe($message) ?? 'Gateway WhatsApp menolak pengiriman.';
        }

        $detail = $status !== '' ? ' ('.$status.')' : '';

        return 'Gateway WhatsApp menolak pengiriman'.$detail.'.';
    }

    private static function looksLikeNetworkError(string $raw): bool
    {
        return (bool) preg_match(
            '/cURL error|Connection refused|Connection timed out|Operation timed out|Could not resolve host|resolve host|timed out|SSL certificate|stream_socket_client/i',
            $raw,
        );
    }

    /** Rapikan spasi berlebih dan potong supaya pas di kolom tabel. */
    private static function tidy(string $raw): string
    {
        return Str::limit(preg_replace('/\s+/', ' ', $raw) ?? $raw, 160);
    }
}
