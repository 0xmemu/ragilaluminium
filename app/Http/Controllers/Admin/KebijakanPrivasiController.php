<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\CmsDocumentSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class KebijakanPrivasiController extends Controller
{
    public function edit(): Response
    {
        $data = CmsDocumentSettings::get(CmsDocumentSettings::KEY_PRIVASI);

        return Inertia::render('Admin/CmsDocument/Edit', [
            'title' => 'Kebijakan Privasi',
            'description' => 'Kelola dokumen kebijakan privasi yang tampil di halaman publik /policy/privacy.',
            'document' => [
                'title' => $data['title'],
                'heading' => $data['heading'],
                'body' => $data['body'],
                'published' => $data['published'],
                'slug' => $data['slug'],
            ],
            'submitUrl' => route('admin.kebijakan-privasi.update'),
            'previewUrl' => route('privacy'),
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
            CmsDocumentSettings::KEY_PRIVASI,
            $validated,
            $request->user()?->id,
        );

        ActivityLogService::record(
            'cms.kebijakan_privasi_updated',
            'cms_page',
            CmsDocumentSettings::pageId(CmsDocumentSettings::KEY_PRIVASI),
            ['title' => $validated['title']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.kebijakan-privasi.edit')
            ->with('success', 'Dokumen Kebijakan Privasi disimpan.');
    }
}
