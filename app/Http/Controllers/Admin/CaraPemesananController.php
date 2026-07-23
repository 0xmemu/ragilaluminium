<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\CaraPemesananSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CaraPemesananController extends Controller
{
    public function edit(): Response
    {
        $data = CaraPemesananSettings::get();

        return Inertia::render('Admin/CaraPemesanan/Edit', [
            'title' => 'Cara Pemesanan',
            'description' => 'Kelola panduan langkah belanja yang tampil di halaman publik /cara-pemesanan.',
            'page' => [
                'title' => $data['title'],
                'published' => $data['published'],
                'heading' => $data['heading'],
                'subtitle' => $data['subtitle'],
                'body' => $data['body'],
                'steps' => $data['steps'],
                'info_cards' => $data['info_cards'],
            ],
            'iconOptions' => CaraPemesananSettings::ICONS,
            'submitUrl' => route('admin.cara-pemesanan.update'),
            'previewUrl' => route('cara-pemesanan'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'published' => ['boolean'],
            'heading' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:320'],
            'body' => ['nullable', 'string', 'max:20000'],
            'steps' => ['required', 'array', 'min:1', 'max:8'],
            'steps.*.icon' => ['required', 'string', Rule::in(CaraPemesananSettings::ICONS)],
            'steps.*.title' => ['required', 'string', 'max:80'],
            'steps.*.description' => ['nullable', 'string', 'max:400'],
            'steps.*.points' => ['nullable'],
            'info_cards' => ['nullable', 'array', 'max:6'],
            'info_cards.*.icon' => ['required', 'string', Rule::in(CaraPemesananSettings::ICONS)],
            'info_cards.*.title' => ['required', 'string', 'max:80'],
            'info_cards.*.description' => ['nullable', 'string', 'max:320'],
        ]);

        $validated['published'] = $validated['published'] ?? false;
        $validated['steps'] = array_map(function (array $step) {
            $points = $step['points'] ?? [];
            if (is_string($points)) {
                $points = preg_split('/\r\n|\r|\n/', $points) ?: [];
            }
            $step['points'] = is_array($points) ? $points : [];

            return $step;
        }, $validated['steps']);

        CaraPemesananSettings::update($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.cara_pemesanan_updated',
            'cms_page',
            CaraPemesananSettings::pageId(),
            [
                'step_count' => count($validated['steps']),
                'info_card_count' => count($validated['info_cards'] ?? []),
            ],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.cara-pemesanan.edit')
            ->with('success', 'Cara pemesanan disimpan.');
    }
}
