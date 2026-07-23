<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsGalleryItem;
use App\Support\InstallationPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GalleryItemController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Admin/Testimonials/GalleryForm', [
            'item' => null,
            'submitUrl' => route('admin.gallery-items.store'),
            'indexUrl' => route('admin.testimonials.index', ['tab' => 'foto']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['cms_page_id'] = InstallationPageSettings::pageId();

        CmsGalleryItem::create($validated);

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'foto'])
            ->with('success', 'Ulasan foto ditambahkan.');
    }

    public function edit(CmsGalleryItem $galleryItem): Response
    {
        return Inertia::render('Admin/Testimonials/GalleryForm', [
            'item' => [
                'id' => $galleryItem->id,
                'label' => $galleryItem->label,
                'image_url' => $galleryItem->image_url,
                'sort_order' => $galleryItem->sort_order,
                'published' => $galleryItem->published,
            ],
            'submitUrl' => route('admin.gallery-items.update', $galleryItem),
            'indexUrl' => route('admin.testimonials.index', ['tab' => 'foto']),
        ]);
    }

    public function update(Request $request, CmsGalleryItem $galleryItem): RedirectResponse
    {
        $galleryItem->update($this->validated($request));

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'foto'])
            ->with('success', 'Ulasan foto diperbarui.');
    }

    public function publish(CmsGalleryItem $galleryItem): RedirectResponse
    {
        $galleryItem->update(['published' => true]);

        return back()->with('success', 'Ulasan foto dipublikasikan.');
    }

    public function unpublish(CmsGalleryItem $galleryItem): RedirectResponse
    {
        $galleryItem->update(['published' => false]);

        return back()->with('success', 'Ulasan foto disembunyikan.');
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request): array
    {
        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'image_url' => ['required', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'published' => ['boolean'],
        ]);

        $validated['published'] = $request->boolean('published');
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['label'] = $validated['label'] ?: null;

        return $validated;
    }
}
