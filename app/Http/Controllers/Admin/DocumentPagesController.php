<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DocumentPagesController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Beranda/Index', [
            'title' => 'Dokumen Halaman',
            'description' => 'Kelola dokumen legal dan profil yang tampil di halaman publik. Klik "Edit konten" untuk membuka editor. ',
            'sections' => [
                ['key' => 'tentang_kami', 'enabled' => true, 'sort_order' => 0, 'label' => 'Informasi Toko', 'description' => 'Profil perusahaan di halaman publik /about.', 'icon' => 'store', 'edit_href' => route('admin.tentang-kami.edit')],
                ['key' => 'ketentuan_layanan', 'enabled' => true, 'sort_order' => 1, 'label' => 'Ketentuan Layanan', 'description' => 'Syarat dan ketentuan penggunaan toko.', 'icon' => 'gavel', 'edit_href' => route('admin.ketentuan-layanan.edit')],
                ['key' => 'kebijakan_privasi', 'enabled' => true, 'sort_order' => 2, 'label' => 'Kebijakan Privasi', 'description' => 'Kebijakan perlindungan data pelanggan.', 'icon' => 'lock', 'edit_href' => route('admin.kebijakan-privasi.edit')],
            ],
            'submitUrl' => route('admin.documents.update'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        return redirect()->route('admin.documents.index')->with('success', 'Dokumen Halaman disimpan.');
    }
}
