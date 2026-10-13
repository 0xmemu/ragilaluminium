<?php

namespace App\Support;


class ConsultationWhatsApp
{
    /**
     * Naskah draf tombol Chat WhatsApp di storefront.
     *
     * Konstanta ini satu-satunya sumber naskah; config storefront memakai
     * nilai yang sama sebagai default, dan halaman
     * /admin/whatsapp/templates menampilkannya sebagai bacaan.
     */
    public const DEFAULT_DIRECT_MESSAGE = 'Halo Ragil Aluminium, saya ingin konsultasi ukuran khusus untuk produk aluminium.';

    public static function templateKey(): string
    {
        return (string) config('storefront.consultation_template_key', 'consultation_request');
    }

    public static function directMessage(): string
    {
        return (string) config(
            'storefront.consultation_direct_message',
            self::DEFAULT_DIRECT_MESSAGE,
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
        // Owner 2026-09-17: nomor sesi dibaca dari penyimpanan permanen
        // (disinkronkan saat perangkat tersambung / ganti nomor). Tidak ada
        // HTTP di jalur baca, dan nomor TIDAK hilang saat perangkat terputus:
        // website tetap memakai nomor terakhir sampai nomor baru tersambung.
        return \App\Support\WhatsAppSessionPhone::current();
    }

    /**
     * Nomor WhatsApp otomasi (sesi aktif > WHATSAPP_BUSINESS_PHONE > brand phone).
     * Dengan sinkronisasi otomatis: saat bot connect ke nomor baru, ini ikut berubah.
     */
    public static function businessPhone(): ?string
    {
        // Kontrak owner 2026-09-18: nomor yang diisi admin di Profil & Kontak
        // Toko adalah sumber utama nomor konsultasi, sehingga perubahan nomor
        // langsung berlaku di seluruh storefront (display phone, tombol Chat
        // WhatsApp, direct URL). Nomor sesi WhatsApp hanya cadangan bila admin
        // belum mengisi nomor toko.
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
        return self::waUrlFor(self::directMessage());
    }

    /**
     * Naskah template CTA konsultasi (dibaca dari DB agar edit admin berlaku;
     * fallback ke naskah bawaan katalog). Template ini BUKAN pesan otomatis
     * server: ia hanya terisi di WhatsApp pelanggan saat menekan tombol
     * konsultasi di halaman produk, lalu pelanggan sendiri yang mengirim.
     */
    public static function ctaTemplateBody(): string
    {
        $catalog = \App\Support\WhatsAppAutomationCatalog::find(self::templateKey());
        $fallback = (string) ($catalog['default_body'] ?? self::DEFAULT_DIRECT_MESSAGE);

        try {
            $stored = \App\Models\WhatsAppTemplate::query()
                ->where('internal_key', self::templateKey())
                ->where('status', 'active')
                ->value('body_preview');
        } catch (\Throwable) {
            $stored = null;
        }

        $body = trim((string) $stored);

        return $body !== '' ? $body : $fallback;
    }

    /**
     * URL CTA konsultasi khusus halaman produk: naskah mengikuti template CTA
     * ({{1}} = brand, {{2}} = produk). Bila admin belum menambahkan slot {{2}},
     * baris produk ditambahkan otomatis supaya konteks produk tetap terbawa.
     */
    public static function productDirectUrl(string $productLabel): ?string
    {
        $body = self::ctaTemplateBody();
        $brand = (string) config('sitemap.brand.short_name', 'Ragil Aluminium');

        if (str_contains($body, '{{2}}')) {
            $message = str_replace(['{{1}}', '{{2}}'], [$brand, $productLabel], $body);
        } else {
            $message = str_replace('{{1}}', $brand, $body);
            $message = rtrim($message)."\nProduk: ".$productLabel;
        }

        return self::waUrlFor($message);
    }

    /** Bangun deep link wa.me ke nomor toko dengan naskah terisi. */
    private static function waUrlFor(string $message): ?string
    {
        $normalized = PhoneNumber::normalize(self::businessPhone());
        if (! $normalized) {
            return null;
        }

        $url = 'https://wa.me/'.$normalized;
        if (trim($message) !== '') {
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