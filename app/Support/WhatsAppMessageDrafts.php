<?php

namespace App\Support;

/**
 * Draf pesan WhatsApp yang dibuka pembeli dari storefront (deep link wa.me).
 *
 * Owner 2026-09-17: seksi "Draf chat pembeli" di admin dihapus (dianggap tidak
 * terlalu diperlukan). Naskah kembali menjadi konstanta di kode ini sebagai
 * satu-satunya sumber, dipakai controller storefront untuk mengisi teks awal
 * saat pembeli menekan tombol chat.
 *
 * Placeholder memakai format ":nama" dan diganti lewat body().
 */
final class WhatsAppMessageDrafts
{
    /**
     * @return list<array{key: string, label: string, description: string, body: string}>
     */
    public static function all(): array
    {
        $drafts = [
            [
                'key' => 'order_confirmation',
                'label' => 'Draf chat konfirmasi pesanan',
                'description' => 'Terisi otomatis saat pembeli menekan tombol WhatsApp di halaman konfirmasi pesanan.',
                'body' => 'Halo :brand, saya sudah order :order. Mohon bantuannya.',
            ],
            [
                'key' => 'order_inquiry',
                'label' => 'Draf chat tanya pesanan',
                'description' => 'Terisi otomatis saat pembeli menanyakan pesanannya dari halaman status pesanan.',
                'body' => 'Halo :brand, saya mau bertanya soal order :order. Mohon bantuannya.',
            ],
            [
                'key' => 'order_return',
                'label' => 'Draf chat pengajuan retur',
                'description' => 'Terisi otomatis saat pembeli mengajukan retur dari halaman status pesanan.',
                'body' => 'Halo :brand, saya mau mengajukan retur untuk order :order. Mohon info prosedurnya.',
            ],
            [
                'key' => 'consultation_direct',
                'label' => 'Draf chat konsultasi langsung',
                'description' => 'Terisi otomatis pada tombol Chat WhatsApp di storefront.',
                'body' => ConsultationWhatsApp::directMessage(),
            ],
        ];

        return collect($drafts)
            ->map(fn (array $draft) => [...$draft, 'body' => self::resolveBrand($draft['body'])])
            ->values()
            ->all();
    }

    /** Ganti token ':brand' dengan nama pendek brand toko. */
    private static function resolveBrand(string $body): string
    {
        return str_replace(':brand', self::brandName(), $body);
    }

    /**
     * Naskah draf setelah placeholder diganti nilai sebenarnya.
     *
     * @param  array<string, string>  $replacements  contoh: [':order' => 'ORD26090001']
     */
    public static function body(string $key, array $replacements = []): string
    {
        $draft = collect(self::all())->firstWhere('key', $key);

        if ($draft === null) {
            return '';
        }

        return strtr($draft['body'], $replacements);
    }

    public static function brandName(): string
    {
        return (string) config('sitemap.brand.short_name', 'Ragil Aluminium');
    }
}
