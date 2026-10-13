<?php

namespace App\Support;

use App\Models\CmsPage;

class StoreContactSettings
{
    public const PAGE_SLUG = 'kontak';

    /**
     * Nomor manual yang diisi admin di Kontak Toko.
     *
     * Owner 2026-09-17: hanya dipakai sebagai fallback selama belum ada nomor
     * sesi Baileys tersimpan, nomor sesi selalu menang karena itulah nomor
     * yang benar-benar dipakai mengirim WhatsApp.
     */
    public static function customPhone(): ?string
    {
        $page = CmsSettings::pageBySlug(self::PAGE_SLUG);
        if (! $page || ! is_array($page->content)) {
            return null;
        }

        $blocks = $page->content['blocks'] ?? [];
        $current = null;
        foreach ($blocks as $block) {
            $type = $block['type'] ?? '';
            $text = (string) ($block['text'] ?? '');
            if ($type === 'heading') {
                $current = match (mb_strtolower($text)) {
                    'telepon / whatsapp', 'telepon/wa', 'telepon', 'whatsapp' => 'phone',
                    default => null,
                };
            } elseif ($type === 'paragraph' && $current === 'phone') {
                $trimmed = trim($text);
                if ($trimmed !== '') {
                    return $trimmed;
                }
            }
        }

        return null;
    }

    /**
     * @return array{address: string, phone: string, email: string, hours: string}
     */
    public static function get(): array
    {
        $page = CmsSettings::pageBySlug(self::PAGE_SLUG);
        $fields = ['address' => '', 'phone' => '', 'email' => '', 'hours' => ''];

        if ($page && is_array($page->content)) {
            $blocks = $page->content['blocks'] ?? [];
            $current = null;

            foreach ($blocks as $block) {
                $type = $block['type'] ?? '';
                $text = (string) ($block['text'] ?? '');
                if ($type === 'heading') {
                    $current = match (mb_strtolower($text)) {
                        'alamat' => 'address',
                        'telepon / whatsapp', 'telepon/wa', 'telepon', 'whatsapp' => 'phone',
                        'email' => 'email',
                        'jam operasional' => 'hours',
                        default => null,
                    };
                } elseif ($type === 'paragraph' && $current !== null) {
                    $fields[$current] = trim($text);
                }
            }
        }

        if ($fields['address'] === '') {
            $fields['address'] = (string) config('sitemap.brand.address', '');
        }
        // Owner 2026-09-17: nomor WA di website mengikuti nomor yang tersambung
        // ke Baileys. Nomor manual di CMS hanya dipakai selama belum ada sesi
        // tersimpan (mis. sebelum pairing pertama).
        if (\App\Support\WhatsAppSessionPhone::current() !== null || $fields['phone'] === '') {
            $fields['phone'] = ConsultationWhatsApp::displayPhone();
        }
        if ($fields['email'] === '') {
            $fields['email'] = (string) config('sitemap.brand.email', '');
        }
        if ($fields['hours'] === '') {
            $fields['hours'] = (string) config('sitemap.brand.hours', 'Senin - Sabtu, 08.00 - 17.00 WIB');
        }

        return $fields;
    }

    /**
     * @param array{address?: string|null, phone?: string|null, email?: string|null, hours?: string|null} $fields
     */
    public static function update(array $fields): void
    {
        // Jangan pernah mengosongkan nomor dari CMS: bila form tidak
        // mengirim nomor (mis. field read-only saat sesi bot aktif),
        // pertahankan nilai terakhir supaya data kontak tidak hilang.
        if (blank($fields['phone'] ?? null)) {
            $fields['phone'] = self::get()['phone'];
        }

        $page = CmsPage::firstOrCreate(['slug' => self::PAGE_SLUG], ['title' => 'Kontak Kami']);

        $page->update([
            'title' => 'Kontak Kami',
            'content' => [
                'blocks' => array_values(array_filter([
                    ['type' => 'heading', 'text' => 'Kontak Kami'],
                    ['type' => 'paragraph', 'text' => 'Kami siap membantu Anda. Pilih saluran komunikasi yang paling nyaman.'],
                    filled($fields['address'] ?? '') ? ['type' => 'heading', 'text' => 'Alamat'] : null,
                    filled($fields['address'] ?? '') ? ['type' => 'paragraph', 'text' => trim((string) $fields['address'])] : null,
                    filled($fields['phone'] ?? '') ? ['type' => 'heading', 'text' => 'Telepon / WhatsApp'] : null,
                    filled($fields['phone'] ?? '') ? ['type' => 'paragraph', 'text' => trim((string) $fields['phone'])] : null,
                    filled($fields['email'] ?? '') ? ['type' => 'heading', 'text' => 'Email'] : null,
                    filled($fields['email'] ?? '') ? ['type' => 'paragraph', 'text' => trim((string) $fields['email'])] : null,
                    filled($fields['hours'] ?? '') ? ['type' => 'heading', 'text' => 'Jam Operasional'] : null,
                    filled($fields['hours'] ?? '') ? ['type' => 'paragraph', 'text' => trim((string) $fields['hours'])] : null,
                ])),
            ],
        ]);
    }
}