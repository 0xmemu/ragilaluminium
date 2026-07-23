<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\CmsDocumentSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TentangKamiController extends Controller
{
    public function edit(): Response
    {
        $data = CmsDocumentSettings::get(CmsDocumentSettings::KEY_TENTANG_KAMI);

        return Inertia::render('Admin/CmsDocument/Edit', [
            'title' => 'Informasi Toko',
            'description' => 'Kelola dokumen profil perusahaan yang tampil di halaman publik /about.',
            'document' => [
                'title' => $data['title'],
                'heading' => $data['heading'],
                'body' => $data['body'],
                'published' => $data['published'],
                'slug' => $data['slug'],
            ],
            'submitUrl' => route('admin.tentang-kami.update'),
            'previewUrl' => route('about'),
            'hubUrl' => route('admin.dashboard'),
            'saveLabel' => 'Simpan Pembaruan Dokumen',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['required', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:50000'],
            'published' => ['boolean'],
        ]);
        $validated['published'] = $validated['published'] ?? false;
        $validated['body'] = $validated['body'] ?? '';

        CmsDocumentSettings::update(
            CmsDocumentSettings::KEY_TENTANG_KAMI,
            $validated,
            $request->user()?->id,
        );

        ActivityLogService::record(
            'cms.tentang_kami_updated',
            'cms_page',
            CmsDocumentSettings::pageId(CmsDocumentSettings::KEY_TENTANG_KAMI),
            ['title' => $validated['title']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.tentang-kami.edit')
            ->with('success', 'Dokumen Informasi Toko disimpan.');
    }
}
