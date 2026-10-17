<?php

namespace App\Support;

use App\Models\OperationalSettingVersion;

/**
 * Nomor WhatsApp yang sedang terhubung ke gateway Baileys.
 *
 * Owner 2026-09-17: nomor WA toko rawan berubah, jadi SELURUH tampilan nomor
 * di website (footer, halaman kontak, tombol Chat WhatsApp, CTA konsultasi,
 * tautan pesanan) mengikuti nomor yang benar-benar tersambung ke Baileys.
 *
 * Aturan persistensi:
 *  - Nomor hasil sambungan disimpan permanen (bukan cache) saat berubah.
 *  - Bila Baileys terputus, nomor yang tersimpan TIDAK dihapus, website tetap
 *    memakai nomor terakhir yang diketahui sampai nomor baru tersambung.
 *  - Penyimpanan hanya menulis versi baru ketika nomornya benar-benar berubah
 *    supaya audit log tidak banjir versi identik.
 */
final class WhatsAppSessionPhone
{
    /** Key OperationalSettings untuk nomor sesi terakhir. */
    public const SETTING_KEY = 'whatsapp_session_phone';

    /**
     * Status gateway apa adanya (tanpa persistensi).
     *
     * @return array{configured: bool, connected: bool, phone: string|null, error: string|null}
     */
    public static function gatewayStatus(): array
    {
        $baseUrl = rtrim((string) config('services.whatsapp.baileys.base_url', ''), '/');
        $configured = $baseUrl !== '';

        if (! $configured) {
            return ['configured' => false, 'connected' => false, 'phone' => null, 'error' => null];
        }

        try {
            $apiKey = (string) config('services.whatsapp.baileys.api_key', '');
            $response = \Illuminate\Support\Facades\Http::timeout(4)
                ->withHeaders($apiKey !== '' ? ['X-Api-Key' => $apiKey] : [])
                ->get($baseUrl.'/status');

            if (! $response->successful()) {
                return [
                    'configured' => true,
                    'connected' => false,
                    'phone' => null,
                    'error' => 'Gateway membalas HTTP '.$response->status().'.',
                ];
            }

            $payload = $response->json() ?? [];
            $connected = ($payload['status'] ?? null) === 'open';
            $rawPhone = (string) ($payload['connected_phone'] ?? ($payload['phone'] ?? ''));
            $phone = $rawPhone === '' ? null : (PhoneNumber::normalize($rawPhone) ?? preg_replace('/[:@].*$/', '', $rawPhone));

            return [
                'configured' => true,
                'connected' => $connected,
                'phone' => $connected ? $phone : null,
                'error' => null,
            ];
        } catch (\Throwable $e) {
            return [
                'configured' => true,
                'connected' => false,
                'phone' => null,
                'error' => 'Gateway tidak dapat dihubungi.',
            ];
        }
    }

    /**
     * Nomor tersimpan terakhir (dipakai seluruh tampilan website).
     * Tidak memanggil HTTP sama sekali supaya halaman publik tetap cepat.
     */
    public static function current(): ?string
    {
        $stored = OperationalSettings::current(self::SETTING_KEY);
        $phone = trim((string) ($stored['phone'] ?? ''));

        return $phone !== '' ? $phone : null;
    }

    /**
     * Sinkronkan nomor dari gateway. Hanya menulis bila nomor berubah.
     *
     * @return array{
     *   configured: bool,
     *   connected: bool,
     *   gateway_phone: string|null,
     *   stored_phone: string|null,
     *   changed: bool,
     *   error: string|null
     * }
     */
    public static function sync(): array
    {
        $status = self::gatewayStatus();
        $stored = self::current();
        $changed = false;

        if ($status['connected'] && $status['phone'] !== null && $status['phone'] !== $stored) {
            OperationalSettings::record(
                self::SETTING_KEY,
                [
                    'phone' => $status['phone'],
                    'previous_phone' => $stored,
                    'synced_at' => now()->toIso8601String(),
                ],
                null,
                'whatsapp_gateway',
                $stored === null
                    ? 'Nomor WhatsApp toko tersinkron dari perangkat yang tersambung.'
                    : 'Nomor WhatsApp toko berubah mengikuti perangkat yang baru tersambung.',
            );

            $stored = $status['phone'];
            $changed = true;
        }

        return [
            'configured' => $status['configured'],
            'connected' => $status['connected'],
            'gateway_phone' => $status['phone'],
            'stored_phone' => $stored,
            'changed' => $changed,
            'error' => $status['error'],
        ];
    }

    /** Waktu sinkronisasi terakhir (untuk tampilan admin). */
    public static function lastSyncedAt(): ?string
    {
        $stored = OperationalSettings::current(self::SETTING_KEY);
        $value = trim((string) ($stored['synced_at'] ?? ''));

        return $value !== '' ? $value : null;
    }

    /** Jumlah versi tersimpan, dipakai test/diagnostik. */
    public static function versions(): int
    {
        if (! OperationalSettings::available()) {
            return 0;
        }

        return OperationalSettingVersion::query()
            ->where('setting_key', self::SETTING_KEY)
            ->count();
    }
}
