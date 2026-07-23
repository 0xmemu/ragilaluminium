<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/ResourceShow', [
            'title' => 'Pengaturan Sistem',
            'subtitle' => 'Status integrasi dari environment server (.env / config) — read-only di admin.',
            'fields' => [
                ['label' => 'WhatsApp Base URL', 'value' => config('services.whatsapp.base_url')],
                ['label' => 'WhatsApp Number ID', 'value' => config('services.whatsapp.number_id') ?: '-'],
                ['label' => 'WhatsApp Token', 'value' => config('services.whatsapp.token') ? 'ter-setting' : 'belum di-set'],
                ['label' => 'JNT Base URL', 'value' => config('services.shipping.jnt.base_url') ?: '-'],
                ['label' => 'JNT API Key', 'value' => config('services.shipping.jnt.api_key') ? 'ter-set' : 'belum di-set'],
                ['label' => 'Filesystem Default', 'value' => config('filesystems.default')],
                ['label' => 'Media Disk', 'value' => config('filesystems.disks.media.driver', env('MEDIA_DISK'))],
            ],
            'sections' => [],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        // System settings are stored in .env / config; admin edits are reflected
        // via environment configuration. This persists display-only confirmation.
        return redirect()->route('admin.settings.index')
            ->with('success', 'Pengaturan disimpan. Konfigurasi integrasi dikelola via .env / config.');
    }
}
