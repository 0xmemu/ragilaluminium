<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Support\CmsDocumentSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DocumentPagesController extends Controller
{
    public function index(): Response
    {
        $ketentuan = CmsPage::query()->where('slug', CmsDocumentSettings::KEY_KETENTUAN)->first();
        $privasi = CmsPage::query()->where('slug', CmsDocumentSettings::KEY_PRIVASI)->first();

        return Inertia::render('Admin/Documents/Index', [
            'title' => 'Dokumen Halaman',
            'description' => 'Kelola dokumen legal dan kebijakan publik yang tampil di toko online.',
            'documents' => [
                [
                    'key' => 'ketentuan_layanan',
                    'title' => 'Ketentuan Layanan',
                    'description' => 'Syarat dan ketentuan transaksi, pemesanan, dan layanan toko.',
                    'slug' => 'terms',
                    'public_url' => route('terms'),
                    'edit_url' => route('admin.ketentuan-layanan.edit'),
                    'updated_at' => optional($ketentuan?->updated_at)->toDateTimeString(),
                    'published' => (bool) ($ketentuan?->published ?? true),
                ],
                [
                    'key' => 'kebijakan_privasi',
                    'title' => 'Kebijakan Privasi',
                    'description' => 'Kebijakan perlindungan data pribadi dan privasi pelanggan.',
                    'slug' => 'privacy',
                    'public_url' => route('privacy'),
                    'edit_url' => route('admin.kebijakan-privasi.edit'),
                    'updated_at' => optional($privasi?->updated_at)->toDateTimeString(),
                    'published' => (bool) ($privasi?->published ?? true),
                ],
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        return redirect()->route('admin.documents.index')->with('success', 'Dokumen Halaman disimpan.');
    }
}
