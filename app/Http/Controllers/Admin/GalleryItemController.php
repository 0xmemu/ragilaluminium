<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessUploadedMediaAsset;
use App\Models\CmsGalleryItem;
use App\Models\MediaAsset;
use App\Support\InstallationPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
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
            'presignUrl' => route('admin.media.presign'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $image = $this->resolveImage($request, existing: null);
        $validated['cms_page_id'] = InstallationPageSettings::pageId();

        CmsGalleryItem::create($image + $validated);

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
            'presignUrl' => route('admin.media.presign'),
        ]);
    }

    public function update(Request $request, CmsGalleryItem $galleryItem): RedirectResponse
    {
        $image = $this->resolveImage($request, existing: $galleryItem);
        $galleryItem->update($image + $this->validated($request));

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
            'image_url' => ['nullable', 'string', 'max:2048'],
            'object_key' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'published' => ['boolean'],
        ]);

        $validated['published'] = $request->boolean('published');
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['label'] = $validated['label'] ?: null;

        return $validated;
    }

    /**
     * Resolusi gambar galeri: upload langsung (object_key hasil presign) ->
     * URL lama / URL input manual.
     *
     * @return array{image_url: string, media_asset_id: ?int}
     */
    protected function resolveImage(Request $request, ?CmsGalleryItem $existing): array
    {
        if ($request->filled('object_key')) {
            $key = (string) $request->input('object_key');
            $disk = Storage::disk(config('media.disk', 'media'));
            if (! str_starts_with($key, 'pending/') || ! $disk->exists($key)) {
                throw ValidationException::withMessages([
                    'image_url' => 'File upload tidak ditemukan. Silakan unggah ulang.',
                ]);
            }

            $asset = MediaAsset::create([
                'kind' => 'image',
                'label' => pathinfo($key, PATHINFO_FILENAME),
                'checksum' => null,
                'source_url' => null,
                'object_key' => $key,
                'mime_type' => $this->mimeFromKey($key),
                'size_bytes' => (int) ($disk->size($key) ?: 0),
                'status' => 'pending',
                'visibility' => 'visible',
                'created_by_user_id' => (int) $request->user()->id,
            ]);
            ProcessUploadedMediaAsset::dispatch($asset->id);

            if ($existing?->media_asset_id && $existing->media_asset_id !== $asset->id) {
                MediaAsset::where('id', $existing->media_asset_id)
                    ->where('status', '!=', 'archived')
                    ->update(['status' => 'archived']);
            }

            return [
                'image_url' => $disk->url($key),
                'media_asset_id' => $asset->id,
            ];
        }

        if ($request->filled('image_url')) {
            return [
                'image_url' => trim((string) $request->input('image_url')),
                'media_asset_id' => $existing?->media_asset_id,
            ];
        }

        throw ValidationException::withMessages([
            'image_url' => 'Unggah gambar atau isi URL gambar.',
        ]);
    }

    protected function mimeFromKey(string $key): string
    {
        return match (strtolower(pathinfo($key, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => 'application/octet-stream',
        };
    }
}
