<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\AboutPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TentangKamiController extends Controller
{
    public function edit(): Response
    {
        $data = AboutPageSettings::getForAdmin();

        return Inertia::render('Admin/TentangKami/Edit', [
            'title' => 'Tentang Kami',
            'description' => 'Isi konten halaman profil toko /about. Tampilan tetap mengikuti desain toko, Anda cukup mengisi teks dan ikon.',
            'page' => $data,
            'iconOptions' => AboutPageSettings::ICONS,
            'submitUrl' => route('admin.tentang-kami.update'),
            'previewUrl' => route('about'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'hero_title' => ['nullable', 'string', 'max:120'],
            'hero_tagline' => ['nullable', 'string', 'max:320'],
            'why_points' => ['nullable', 'array', 'max:6'],
            'why_points.*.icon' => ['nullable', 'string', 'max:40'],
            'why_points.*.title' => ['nullable', 'string', 'max:60'],
            'why_points.*.body' => ['nullable', 'string', 'max:200'],
            'work_steps' => ['nullable', 'array', 'max:4'],
            'work_steps.*.title' => ['nullable', 'string', 'max:60'],
            'work_steps.*.body' => ['nullable', 'string', 'max:200'],
            'trust_rows' => ['nullable', 'array', 'max:6'],
            'trust_rows.*' => ['nullable', 'string', 'max:120'],
        ]);

        // Baris yang judulnya kosong diabaikan (bukan error): admin bebas
        // menambah/menghapus baris di form tanpa terblokir validasi.
        $validated['why_points'] = array_values(array_filter(
            $validated['why_points'] ?? [],
            fn (array $row) => trim((string) ($row['title'] ?? '')) !== '',
        ));
        $validated['work_steps'] = array_values(array_filter(
            $validated['work_steps'] ?? [],
            fn (array $row) => trim((string) ($row['title'] ?? '')) !== '',
        ));

        AboutPageSettings::update($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.tentang_kami_updated',
            'cms_page',
            AboutPageSettings::pageId(),
            [
                'why_points' => count($validated['why_points'] ?? []),
                'work_steps' => count($validated['work_steps'] ?? []),
            ],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.tentang-kami.edit')
            ->with('success', 'Konten Tentang Kami disimpan.');
    }
}
