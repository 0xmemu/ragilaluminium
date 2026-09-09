<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Services\ActivityLogService;
use App\Support\StorefrontPlatformSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StorefrontPlatformController extends Controller
{
    public function edit(Request $request): Response
    {
        $tab = $request->query('tab') === 'kontak' ? 'kontak' : 'marketplace';

        $kontakPage = CmsPage::where('slug', 'kontak')->first();
        $kontakFields = $kontakPage && is_array($kontakPage->content)
            ? $this->extractKontakFields($kontakPage->content)
            : ['address' => '', 'phone' => '', 'email' => '', 'hours' => ''];

        return Inertia::render('Admin/StorefrontPlatforms/Edit', [
            'title' => 'Profil & Kontak Toko',
            'description' => 'Kelola tautan akun toko resmi di marketplace, media sosial, serta informasi kontak dan workshop.',
            'tab' => $tab,
            'tabs' => [
                [
                    'key' => 'marketplace',
                    'label' => 'Marketplace & Media Sosial',
                    'href' => route('admin.storefront-platforms.edit', ['tab' => 'marketplace']),
                ],
                [
                    'key' => 'kontak',
                    'label' => 'Kontak & Jam Kerja',
                    'href' => route('admin.storefront-platforms.edit', ['tab' => 'kontak']),
                ],
            ],
            'platforms' => StorefrontPlatformSettings::forAdmin(),
            'submitUrl' => route('admin.storefront-platforms.update'),
            'kontakFields' => $kontakFields,
            'kontakSubmitUrl' => route('admin.beranda.kontak.update'),
            'previewUrl' => route('about'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $keys = StorefrontPlatformSettings::allowedKeys();

        $validated = $request->validate([
            'links' => ['required', 'array'],
            'links.*' => ['nullable', 'string', 'max:500'],
        ]);

        $links = [];
        $errors = [];
        foreach ($keys as $key) {
            $raw = trim((string) ($validated['links'][$key] ?? ''));
            if ($raw === '' || $raw === '#') {
                $links[$key] = '';

                continue;
            }
            if (! preg_match('#^https?://#i', $raw)) {
                $errors["links.{$key}"] = 'Gunakan URL lengkap diawali http:// atau https://.';

                continue;
            }
            $links[$key] = $raw;
        }

        if ($errors !== []) {
            return redirect()
                ->back()
                ->withInput()
                ->withErrors($errors);
        }

        StorefrontPlatformSettings::update($links, $request->user()?->id);

        $pageId = CmsPage::query()
            ->where('slug', StorefrontPlatformSettings::PAGE_SLUG)
            ->value('id');

        ActivityLogService::record(
            'cms.storefront_platforms_updated',
            'cms_page',
            $pageId ? (int) $pageId : null,
            ['keys' => array_keys(array_filter($links))],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.storefront-platforms.edit')
            ->with('success', 'Tautan marketplace & media sosial disimpan.');
    }

    /** @return array<string, string> */
    private function extractKontakFields(array $content): array
    {
        $blocks = $content['blocks'] ?? [];
        $current = null;
        $fields = ['address' => '', 'phone' => '', 'email' => '', 'hours' => ''];

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
                $fields[$current] = $text;
            }
        }

        return $fields;
    }
}
