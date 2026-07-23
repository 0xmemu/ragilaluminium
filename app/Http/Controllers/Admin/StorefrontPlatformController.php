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
    public function edit(): Response
    {
        return Inertia::render('Admin/StorefrontPlatforms/Edit', [
            'title' => 'Marketplace & Media Sosial',
            'description' => 'Atur tautan eksternal toko resmi di marketplace dan akun media sosial. Tampil di Informasi Toko dan footer.',
            'platforms' => StorefrontPlatformSettings::forAdmin(),
            'submitUrl' => route('admin.storefront-platforms.update'),
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
}
