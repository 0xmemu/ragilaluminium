<?php

namespace App\Support;

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
     * Nomor WhatsApp otomasi (WHATSAPP_BUSINESS_PHONE), fallback brand phone.
     * Dipakai untuk wa.me + tampilan storefront agar selalu sinkron.
     */
    public static function businessPhone(): ?string
    {
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
            'directLabel' => 'Chat Langsung Di WhatsApp',
            'phoneLabel' => 'Nomor HP/WhatsApp',
            'phoneHint' => '*Kami akan langsung menghubungi Anda',
            'submitLabel' => 'Konsultasi',
            'phone' => self::displayPhone(),
        ];
    }
}
