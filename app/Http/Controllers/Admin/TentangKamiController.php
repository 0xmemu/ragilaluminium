<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\AboutPageSettings;
use App\Support\StoreContactSettings;
use App\Support\StorefrontPlatformSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TentangKamiController extends Controller
{
    public function edit(): Response
    {
        $page = AboutPageSettings::getForAdmin();
        $contact = StoreContactSettings::get();
        $platforms = StorefrontPlatformSettings::forAdmin();

        return Inertia::render('Admin/TentangKami/Edit', [
            'title' => 'Tentang Kami',
            'description' => 'Pusat pengelolaan profil, identitas bisnis, kontak, keunggulan, proses produksi, media sosial, dan marketplace.',
            'page' => $page,
            'contact' => $contact,
            'platforms' => $platforms,
            'iconOptions' => AboutPageSettings::iconOptions(),
            'submitUrl' => route('admin.tentang-kami.update'),
            'previewUrl' => route('about'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'hero_title' => ['nullable', 'string', 'max:120'],
            'hero_subtitle' => ['nullable', 'string', 'max:120'],
            'hero_tagline' => ['nullable', 'string', 'max:320'],
            'hero_headline' => ['nullable', 'string', 'max:320'],
            'hero_description' => ['nullable', 'string', 'max:2000'],
            'main_image_url' => ['nullable', 'string', 'max:2048'],
            'main_media_asset_id' => ['nullable', 'integer'],
            'gallery_items' => ['nullable', 'array', 'max:4'],
            'gallery_items.*.media_asset_id' => ['nullable', 'integer'],
            'gallery_items.*.url' => ['nullable', 'string', 'max:2048'],
            'gallery_items.*.title' => ['nullable', 'string', 'max:60'],
            'gallery_items.*.caption' => ['nullable', 'string', 'max:200'],
            'stats_items' => ['nullable', 'array', 'max:4'],
            'stats_items.*.value' => ['nullable', 'string', 'max:40'],
            'stats_items.*.label' => ['nullable', 'string', 'max:60'],
            'stats_items.*.description' => ['nullable', 'string', 'max:120'],
            'why_points' => ['nullable', 'array', 'max:6'],
            'why_points.*.icon' => ['nullable', 'string', 'max:40'],
            'why_points.*.title' => ['nullable', 'string', 'max:60'],
            'why_points.*.body' => ['nullable', 'string', 'max:200'],
            'production_processes' => ['nullable', 'array', 'max:4'],
            'production_processes.*.icon' => ['nullable', 'string', 'max:40'],
            'production_processes.*.title' => ['nullable', 'string', 'max:60'],
            'production_processes.*.description' => ['nullable', 'string', 'max:250'],
            'production_processes.*.image_url' => ['nullable', 'string', 'max:2048'],
            'work_steps' => ['nullable', 'array', 'max:4'],
            'work_steps.*.title' => ['nullable', 'string', 'max:60'],
            'work_steps.*.body' => ['nullable', 'string', 'max:200'],
            'trust_rows' => ['nullable', 'array', 'max:6'],
            'trust_rows.*' => ['nullable', 'string', 'max:120'],
            'google_maps_url' => ['nullable', 'string', 'max:2048'],
            'google_maps_embed_url' => ['nullable', 'string', 'max:2048'],
            'contact' => ['nullable', 'array'],
            'contact.address' => ['nullable', 'string', 'max:500'],
            'contact.phone' => ['nullable', 'string', 'max:100'],
            'contact.email' => ['nullable', 'email', 'max:150'],
            'contact.hours' => ['nullable', 'string', 'max:500'],
            'platforms' => ['nullable', 'array'],
        ]);

        // Simpan profil Tentang Kami
        AboutPageSettings::update($validated, $request->user()?->id);

        // Sinkronisasi Kontak & Toko jika dikirim
        if ($request->has('contact') && is_array($request->input('contact'))) {
            StoreContactSettings::update($request->input('contact'));
        }

        // Sinkronisasi Marketplace & Media Sosial jika dikirim
        if ($request->has('platforms') && is_array($request->input('platforms'))) {
            StorefrontPlatformSettings::update($request->input('platforms'), $request->user()?->id);
        }

        ActivityLogService::record(
            'cms.tentang_kami_updated',
            'cms_page',
            AboutPageSettings::pageId(),
            [
                'why_points' => count($validated['why_points'] ?? []),
                'work_steps' => count($validated['work_steps'] ?? []),
                'gallery_items' => count($validated['gallery_items'] ?? []),
                'stats_items' => count($validated['stats_items'] ?? []),
            ],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.tentang-kami.edit')
            ->with('success', 'Profil dan informasi Tentang Kami berhasil disimpan.');
    }
}
