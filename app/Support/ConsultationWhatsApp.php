<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class ConsultationWhatsApp
{
    public static function templateKey(): string
    {
        return (string) config('storefront.consultation_template_key', 'consultation_request');
    }

    public static function directMessage(): string
    {
        return (string) config(
            'storefront.consultation_direct_message',
            'Halo Ragil Aluminium, saya ingin konsultasi ukuran khusus untuk produk aluminium.',
        );
    }

    /** @return list<string> */
    public static function templateVariables(): array
    {
        return [
            config('sitemap.brand.short_name', 'Ragil Aluminium'),
        ];
    }

    /**
     * Nomor sesi WhatsApp yang aktif (Baileys gateway), bila terhubung.
     * Di-cache singkat (~40s) supaya halaman publik tidak memanggil bot berulang-ulang.
     *
     * Pendekatan read-through dengan invalidasi:
     *  - saat gateway menjawab "open" + phone -> cache nomor (TTL pendek).
     *  - saat gateway tidak open / gagal / tanpa phone -> cache dihapus & return null
     *    (mis. supaya saat bot disconnect, tampilan segera turun ke config, bukan nomor lama).
     */
    public static function activeSessionPhone(): ?string
    {
        $cached = Cache::get('whatsapp.active_session_phone');

        // Hit cache cepat: kalau sudah ada nilai non-empty, pakai (menghindari HTTP per request).
        if (is_string($cached) && trim($cached) !== '') {
            return trim($cached);
        }

        // (Nullable) miss / nilai cached kosong -> lakukan fetch.
        $fetched = self::fetchActiveSessionPhone();
        if ($fetched !== null) {
            Cache::put('whatsapp.active_session_phone', $fetched, 40);
            return $fetched;
        }

        // Gagal / tidak open -> pastikan tidak ada nilai lama tersisa.
        Cache::forget('whatsapp.active_session_phone');
        return null;
    }

    protected static function fetchActiveSessionPhone(): ?string
    {
        try {
            $base = rtrim((string) config('services.whatsapp.baileys.base_url', ''), '/');
            $key  = (string) config('services.whatsapp.baileys.api_key', '');
            if ($base === '') {
                return null;
            }

            $response = Http::timeout(4)
                ->withHeaders($key !== '' ? ['X-Api-Key' => $key] : [])
                ->get($base.'/status');

            if ($response->failed()) {
                return null;
            }

            $status = (string) ($response->json('status') ?? '');
            $phone  = trim((string) ($response->json('phone') ?? ''));

            if ($status !== 'open' || $phone === '') {
                return null;
            }

            return $phone;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Nomor WhatsApp otomasi (sesi aktif > WHATSAPP_BUSINESS_PHONE > brand phone).
     * Dengan sinkronisasi otomatis: saat bot connect ke nomor baru, ini ikut berubah.
     */
    public static function businessPhone(): ?string
    {
        // Nomor yang dideklarasikan admin di Profil & Kontak Toko adalah sumber
        // utama nomor konsultasi: perubahan nomor langsung berlaku di seluruh
        // storefront (display phone, tombol Chat WhatsApp, dan direct URL).
        $custom = \App\Support\StoreContactSettings::customPhone();
        if ($custom !== null) {
            return $custom;
        }

        $sessionPhone = self::activeSessionPhone();
        if ($sessionPhone !== null) {
            return $sessionPhone;
        }

        $phone = trim((string) (
            config('services.whatsapp.business_phone')
            ?: config('sitemap.brand.phone')
            ?: ''
        ));

        return $phone !== '' ? $phone : null;
    }

    /** Nomor untuk ditampilkan di storefront (format +62 …). */
    public static function displayPhone(): string
    {
        return PhoneNumber::formatDisplay(self::businessPhone()) ?? '';
    }

    public static function directUrl(): ?string
    {
        $normalized = PhoneNumber::normalize(self::businessPhone());
        if (! $normalized) {
            return null;
        }

        $url = 'https://wa.me/'.$normalized;
        $message = self::directMessage();
        if ($message !== '') {
            $url .= '?text='.rawurlencode($message);
        }

        return $url;
    }

    /**
     * @return array{
     *   directUrl: string|null,
     *   directLabel: string,
     *   phoneLabel: string,
     *   phoneHint: string,
     *   submitLabel: string,
     *   phone: string
     * }
     */
    public static function sharedProps(): array
    {
        return [
            'directUrl' => self::directUrl(),
            'directLabel' => 'Chat WhatsApp',
            'phoneLabel' => 'Nomor HP/WhatsApp',
            'phoneHint' => '*Kami akan langsung menghubungi Anda',
            'submitLabel' => 'Konsultasi',
            'phone' => self::displayPhone(),
        ];
    }
}