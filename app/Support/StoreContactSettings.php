<?php

namespace App\Support;

use App\Models\CmsPage;

class StoreContactSettings
{
    public const PAGE_SLUG = 'kontak';

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
        if ($fields['phone'] === '') {
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
}
