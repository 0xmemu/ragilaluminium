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

    public static function directUrl(): ?string
    {
        $phone = config('services.whatsapp.business_phone')
            ?: config('sitemap.brand.phone');

        $normalized = PhoneNumber::normalize($phone);
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

    /** @return array{directUrl: string|null, directLabel: string, phoneLabel: string, phoneHint: string, submitLabel: string} */
    public static function sharedProps(): array
    {
        return [
            'directUrl' => self::directUrl(),
            'directLabel' => 'Chat Langsung Di WhatsApp',
            'phoneLabel' => 'Nomor HP/WhatsApp',
            'phoneHint' => '*Kami akan langsung menghubungi Anda',
            'submitLabel' => 'Konsultasi',
        ];
    }
}
