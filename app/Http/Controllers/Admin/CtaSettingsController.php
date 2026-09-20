<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Services\ActivityLogService;
use App\Support\CtaSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Editor teks CTA storefront (banner penutup, kartu reusable, tombol judul
 * section, kondisi kosong).
 *
 * Halaman ini menampilkan teks yang BENAR-BENAR dipakai storefront hari ini
 * (dari resources/js/lib/cta-live.json) berdampingan dengan nilai yang sudah
 * disimpan admin. Selama admin belum menyimpan, storefront tetap memakai
 * teksnya sendiri, jadi membuka halaman ini tidak mengubah apa pun.
 */
class CtaSettingsController extends Controller
{
    public function edit(): Response
    {
        $settings = CtaSettings::get();
        $live = CtaSettings::live();

        $blocks = [];
        foreach ($live as $key => $block) {
            $stored = $settings['pages'][$key] ?? [
                'eyebrow' => null,
                'heading' => null,
                'actions' => [],
                'items' => [],
            ];

            $blocks[] = [
                'key' => $key,
                'label' => $block['label'],
                'kind' => $block['kind'],
                'preview_url' => $block['preview_url'],
                'dynamic' => $block['dynamic'],
                'note' => $block['note'],
                // Teks storefront saat ini, dipakai sebagai placeholder dan
                // pratinjau supaya admin melihat keadaannya sebelum menyimpan.
                'live' => [
                    'eyebrow' => $block['eyebrow'],
                    'heading' => $block['heading'],
                    'actions' => $block['actions'],
                    'items' => $block['items'],
                ],
                // Nilai tersimpan; null berarti blok ini masih memakai teks live.
                'stored' => [
                    'eyebrow' => $stored['eyebrow'],
                    'heading' => $stored['heading'],
                    'actions' => $stored['actions'],
                    'items' => $stored['items'],
                ],
            ];
        }

        return Inertia::render('Admin/CtaStorefront/Edit', [
            'title' => 'CTA Storefront',
            'description' => 'Atur teks, tombol, dan warna ajakan di storefront. Yang tampil adalah teks asli storefront; perubahan berlaku setelah Anda menyimpan.',
            'submitUrl' => route('admin.cta-settings.update'),
            'enabled' => $settings['enabled'],
            'color' => $settings['color'],
            'defaultColor' => CtaSettings::DEFAULT_COLOR,
            // Batas mengikuti validasi server supaya UI dan backend tidak
            // pernah berbeda aturan.
            'maxActions' => CtaSettings::MAX_ACTIONS,
            'maxItems' => CtaSettings::MAX_ITEMS,
            // Daftar tujuan tombol: admin memilih dari sini, bukan menyalin URL,
            // supaya jalur konsultasi dan checkout tidak bisa rusak.
            'destinations' => collect(CtaSettings::DESTINATIONS)
                ->map(fn (string $label, string $key): array => ['value' => $key, 'label' => $label])
                ->values()
                ->all(),
            'blocks' => $blocks,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $maxActions = CtaSettings::MAX_ACTIONS;
        $maxItems = CtaSettings::MAX_ITEMS;

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'blocks' => ['required', 'array', 'min:1'],
            'blocks.*.key' => ['required', 'string', 'max:40'],
            'blocks.*.eyebrow' => ['nullable', 'string', 'max:120'],
            'blocks.*.heading' => ['nullable', 'string', 'max:240'],
            // Kontrak owner 2026-09-02: maksimal 2 tombol per CTA.
            'blocks.*.actions' => ['nullable', 'array', "max:{$maxActions}"],
            'blocks.*.actions.*.label' => ['nullable', 'string', 'max:40'],
            'blocks.*.actions.*.destination' => ['nullable', 'string', 'max:40'],
            'blocks.*.actions.*.variant' => ['nullable', 'string', 'in:primary,secondary'],
            // Kartu/poin: maksimal 6 baris, tiap baris punya judul dan keterangan.
            'blocks.*.items' => ['nullable', 'array', "max:{$maxItems}"],
            'blocks.*.items.*.label' => ['nullable', 'string', 'max:120'],
            'blocks.*.items.*.description' => ['nullable', 'string', 'max:240'],
        ]);

        $known = CtaSettings::pages();

        $pages = [];
        foreach ($validated['blocks'] as $block) {
            $key = (string) $block['key'];
            if (! array_key_exists($key, $known)) {
                continue;
            }
            $pages[$key] = [
                'eyebrow' => $block['eyebrow'] ?? null,
                'heading' => $block['heading'] ?? null,
                // CtaSettings membuang tombol tanpa label atau bertujuan tidak
                // sah, lalu membatasi jumlahnya. Daftar kosong berarti blok ini
                // kembali memakai tombol storefront.
                'actions' => $block['actions'] ?? [],
                'items' => $block['items'] ?? [],
            ];
        }

        CtaSettings::update([
            'enabled' => $validated['enabled'],
            'color' => $validated['color'] ?? null,
            'pages' => $pages,
        ], $request->user()?->id);

        ActivityLogService::record(
            'cms.cta_storefront_updated',
            'cms_page',
            (int) (CmsPage::query()->where('slug', CtaSettings::PAGE_SLUG)->value('id') ?? 0),
            [
                'blocks' => array_keys($pages),
                'enabled' => $validated['enabled'],
                'color' => $validated['color'] ?? null,
            ],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.cta-settings.edit')
            ->with('success', 'Teks CTA Storefront disimpan.');
    }
}
