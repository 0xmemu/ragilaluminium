<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\CmsDocumentSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class KetentuanLayananController extends Controller
{
    public function edit(): Response
    {
        $data = CmsDocumentSettings::get(CmsDocumentSettings::KEY_KETENTUAN);

        return Inertia::render('Admin/CmsDocument/Edit', [
            'title' => 'Ketentuan Layanan',
            'description' => 'Kelola dokumen ketentuan layanan yang tampil di halaman publik /policy/terms.',
            'document' => [
                'title' => $data['title'],
                'heading' => $data['heading'],
                'body' => $data['body'],
                'published' => $data['published'],
                'slug' => $data['slug'],
            ],
            'submitUrl' => route('admin.ketentuan-layanan.update'),
            'previewUrl' => route('terms'),
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
            CmsDocumentSettings::KEY_KETENTUAN,
            $validated,
            $request->user()?->id,
        );

        ActivityLogService::record(
            'cms.ketentuan_layanan_updated',
            'cms_page',
            CmsDocumentSettings::pageId(CmsDocumentSettings::KEY_KETENTUAN),
            ['title' => $validated['title']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.ketentuan-layanan.edit')
            ->with('success', 'Dokumen Ketentuan Layanan disimpan.');
    }
}
