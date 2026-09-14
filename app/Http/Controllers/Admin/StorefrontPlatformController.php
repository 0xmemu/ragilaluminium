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
        $requested = (string) $request->query('tab', 'marketplace');
        $tab = in_array($requested, ['marketplace', 'kontak', 'brand'], true) ? $requested : 'marketplace';

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
                [
                    'key' => 'brand',
                    'label' => 'Aset Brand',
                    'href' => route('admin.storefront-platforms.edit', ['tab' => 'brand']),
                ],
            ],
            'brandAssets' => $this->brandAssetsState(),
            'brandSubmitUrl' => route('admin.pages.branding'),
            'platforms' => StorefrontPlatformSettings::forAdmin(),
            'submitUrl' => route('admin.storefront-platforms.update'),
            'kontakFields' => $kontakFields,
            'kontakSubmitUrl' => route('admin.beranda.kontak.update'),
            'previewUrl' => route('about'),
        ]);
    }

    /**
     * Status aset brand yang dipakai <head>: URL ber-cache-busting, ukuran, dan
     * waktu terakhir diubah. Berkas 0 byte dianggap tidak ada, karena browser
     * hanya menampilkan favicon kosong untuk berkas seperti itu.
     *
     * @return array<string, array{path: string, url: string, bytes: int, updated_at: string}|null>
     */
    protected function brandAssetsState(): array
    {
        return [
            'logo' => $this->brandAsset('images/brand/light-logo.png'),
            'favicon' => $this->brandAsset('images/favicon-32.png', 'images/site-favicon.ico'),
            'faviconIco' => $this->brandAsset('images/site-favicon.ico'),
        ];
    }

    /**
     * @param  list<string>  $candidates
     * @return array{path: string, url: string, bytes: int, updated_at: string}|null
     */
    protected function brandAsset(string ...$candidates): ?array
    {
        foreach ($candidates as $candidate) {
            $path = public_path($candidate);
            if (! is_file($path) || filesize($path) === 0) {
                continue;
            }

            return [
                'path' => $candidate,
                'url' => asset($candidate).'?v='.filemtime($path),
                'bytes' => (int) filesize($path),
                'updated_at' => date('d M Y H:i', (int) filemtime($path)),
            ];
        }

        return null;
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
