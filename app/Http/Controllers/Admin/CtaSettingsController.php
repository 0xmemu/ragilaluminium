<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\CtaSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Editor teks CTA penutup storefront (banner merah di akhir halaman publik).
 */
class CtaSettingsController extends Controller
{
    public function edit(): Response
    {
        $settings = CtaSettings::get();

        return Inertia::render('Admin/CtaStorefront/Edit', [
            'title' => 'CTA Storefront',
            'description' => 'Atur kop dan judul ajakan (CTA) di bagian bawah halaman publik. Tombol aksi tetap mengikuti alur sistem.',
            'submitUrl' => route('admin.cta-settings.update'),
            'enabled' => $settings['enabled'],
            'blocks' => collect(CtaSettings::PAGES)
                ->map(fn (string $label, string $key): array => [
                    'key' => $key,
                    'label' => $label,
                    'eyebrow' => $settings['pages'][$key]['eyebrow'],
                    'heading' => $settings['pages'][$key]['heading'],
                    'preview_url' => $this->previewUrl($key),
                ])
                ->values()
                ->all(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'blocks' => ['required', 'array', 'min:1'],
            'blocks.*.key' => ['required', 'string', 'max:40'],
            'blocks.*.eyebrow' => ['nullable', 'string', 'max:120'],
            'blocks.*.heading' => ['nullable', 'string', 'max:240'],
        ]);

        $pages = [];
        foreach ($validated['blocks'] as $block) {
            $key = (string) $block['key'];
            if (! array_key_exists($key, CtaSettings::PAGES)) {
                continue;
            }
            $pages[$key] = [
                'eyebrow' => $block['eyebrow'] ?? null,
                'heading' => $block['heading'] ?? null,
            ];
        }

        CtaSettings::update([
            'enabled' => $validated['enabled'],
            'pages' => $pages,
        ], $request->user()?->id);

        ActivityLogService::record(
            'cms.cta_storefront_updated',
            'cms_page',
            (int) (\App\Models\CmsPage::query()->where('slug', CtaSettings::PAGE_SLUG)->value('id') ?? 0),
            ['blocks' => array_keys($pages), 'enabled' => $validated['enabled']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.cta-settings.edit')
            ->with('success', 'Teks CTA Storefront disimpan.');
    }

    /** Tautan pratinjau halaman publik yang memakai CTA tersebut. */
    private function previewUrl(string $key): ?string
    {
        return match ($key) {
            'home' => route('home', absolute: false),
            'about' => route('about', absolute: false),
            'faq' => route('faq', absolute: false),
            'cara-pemesanan' => route('cara-pemesanan', absolute: false),
            'masalah-solusi' => route('masalah-dan-solusi', absolute: false),
            // Kartu jaminan tampil di keranjang, jadi halaman itu jadi
            // pratinjau terdekat yang selalu bisa dibuka.
            'trust' => route('cart.index', absolute: false),
            default => null,
        };
    }
}
