<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Editor halaman publik "Kontak Kami" (cms_pages slug 'kontak').
 */
class KontakController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:150'],
            'hours' => ['nullable', 'string', 'max:500'],
            'problems_content' => ['nullable', 'string', 'max:5000'],
        ]);

        $page = CmsPage::firstOrCreate(['slug' => 'kontak'], ['title' => 'Kontak Kami']);

        $page->update([
            'title' => 'Kontak Kami',
            'content' => [
                'blocks' => array_values(array_filter([
                    ['type' => 'heading', 'text' => 'Kontak Kami'],
                    $this->block('paragraph', 'Kami siap membantu Anda. Pilih saluran komunikasi yang paling nyaman.'),
                    filled($validated['address'] ?? '') ? $this->block('heading', 'Alamat') : null,
                    filled($validated['address'] ?? '') ? $this->block('paragraph', $validated['address']) : null,
                    filled($validated['phone'] ?? '') ? $this->block('heading', 'Telepon / WhatsApp') : null,
                    filled($validated['phone'] ?? '') ? $this->block('paragraph', $validated['phone']) : null,
                    filled($validated['email'] ?? '') ? $this->block('heading', 'Email') : null,
                    filled($validated['email'] ?? '') ? $this->block('paragraph', $validated['email']) : null,
                    filled($validated['hours'] ?? '') ? $this->block('heading', 'Jam Operasional') : null,
                    filled($validated['hours'] ?? '') ? $this->block('paragraph', $validated['hours']) : null,
                    filled($validated['problems_content'] ?? '') ? $this->block('heading', 'Masalah & Solusi') : null,
                    filled($validated['problems_content'] ?? '') ? $this->block('paragraph', $validated['problems_content']) : null,
                ])),
            ],
        ]);

        ActivityLogService::record('cms.contact_updated', 'cms_page', (int) $page->id, [
            'slug' => 'kontak',
        ], (int) $request->user()->id);

        return redirect()->route('admin.storefront-platforms.edit')
            ->with('success', 'Halaman kontak disimpan.');
    }

    /** @return array{type: string, text: string} */
    private function block(string $type, string $text): array
    {
        return ['type' => $type, 'text' => $text];
    }
}
