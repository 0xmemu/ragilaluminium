<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessUploadedMediaAsset;
use App\Models\CmsBanner;
use App\Models\CmsGalleryItem;
use App\Models\ProductMedia;
use App\Support\MediaNamer;
use App\Models\MediaAsset;
use App\Support\HomepagePromotions;
use App\Support\HomepagePromotionSettings;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BannerController extends Controller
{
    public function index(Request $request): Response
    {
        $view = $request->input('view') === 'list' ? 'list' : 'grid';
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));

        $banners = CmsBanner::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    LikeSearch::whereLike($inner, 'title', $q);
                    LikeSearch::orWhereLike($inner, 'link_url', $q);
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('published', true))
            ->when($status === 'inactive', fn ($query) => $query->where('published', false))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();

        $settings = HomepagePromotionSettings::get();

        return Inertia::render('Admin/Banners/Index', [
            'title' => 'Banner Promo',
            'description' => 'Kelola slide promo beranda (cms_banners) dan banner otomatis dari produk diskon / Flash Sale.',
            'viewMode' => $view,
            'searchQuery' => $q,
            'activeStatus' => in_array($status, ['active', 'inactive'], true) ? $status : 'all',
            'banners' => $banners->getCollection()->map(fn (CmsBanner $b) => $this->bannerCard($b))->values()->all(),
            'pagination' => InertiaAdmin::pagination($banners),
            'createHref' => route('admin.banners.create'),
            'autoPromotions' => [
                'enabled' => $settings['enabled'],
                'max_slides' => $settings['max_slides'],
                'candidate_count' => HomepagePromotions::automaticCandidateCount(),
                'updateUrl' => route('admin.banners.auto-promotions.update'),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Banners/Form', [
            'banner' => null,
            'submitUrl' => route('admin.banners.store'),
            'method' => 'post',
            'indexHref' => route('admin.banners.index'),
            'presignUrl' => route('admin.media.presign'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateBanner($request, requireImage: true);
        $image = $this->resolveBannerImage($request, existing: null, requireImage: true);

        CmsBanner::create([
            'title' => $validated['title'] ?? null,
            'image_url' => $image['image_url'],
            'media_asset_id' => $image['media_asset_id'],
            'link_url' => $validated['link_url'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'published' => $validated['published'],
        ]);

        return redirect()->route('admin.banners.index')->with('success', 'Promo toko dibuat.');
    }

    public function edit(CmsBanner $banner): Response
    {
        return Inertia::render('Admin/Banners/Form', [
            'banner' => $this->bannerCard($banner),
            'submitUrl' => route('admin.banners.update', $banner),
            'method' => 'put',
            'indexHref' => route('admin.banners.index'),
            'presignUrl' => route('admin.media.presign'),
        ]);
    }

    public function update(Request $request, CmsBanner $banner): RedirectResponse
    {
        $validated = $this->validateBanner($request, requireImage: false, existing: $banner);
        $image = $this->resolveBannerImage($request, existing: $banner, requireImage: false);

        $banner->update([
            'title' => $validated['title'] ?? null,
            'image_url' => $image['image_url'],
            'media_asset_id' => $image['media_asset_id'],
            'link_url' => $validated['link_url'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'published' => $validated['published'],
        ]);

        return redirect()->route('admin.banners.index')->with('success', 'Promo toko diperbarui.');
    }

    public function destroy(CmsBanner $banner): RedirectResponse
    {
        $asset = $banner->mediaAsset;
        $imageUrl = $banner->image_url;

        $banner->delete();

        if ($asset) {
            $usedElsewhere = ProductMedia::where('media_asset_id', $asset->id)->exists()
                || CmsBanner::where('media_asset_id', $asset->id)->exists()
                || CmsGalleryItem::where('media_asset_id', $asset->id)->exists();
            if (! $usedElsewhere) {
                $this->deleteAssetFiles($asset);
                $asset->delete();
            } else {
                // Asset dipakai entitas lain (produk/galeri/banner lain) — arsipkan saja.
                $asset->update(['status' => 'archived']);
            }
        } else {
            // Banner legacy: hapus objek R2 bila mengarah ke media disk (mis. banners/...).
            $disk = Storage::disk(config('media.disk', 'media'));
            $path = parse_url((string) $imageUrl, PHP_URL_PATH);
            if ($path) {
                $key = ltrim($path, '/');
                if ($disk->exists($key)) {
                    $disk->delete($key);
                }
            }
        }

        return redirect()->route('admin.banners.index')->with('success', 'Promo toko dihapus.');
    }

    private function deleteAssetFiles(MediaAsset $asset): void
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $keys = [];
        $derivatives = is_array($asset->derivatives) ? $asset->derivatives : [];
        foreach (['thumb', 'card', 'pdp', 'poster', 'video'] as $variant) {
            $path = $derivatives[$variant]['path'] ?? null;
            if ($path && $disk->exists($path)) {
                $keys[] = $path;
            }
        }
        if ($asset->object_key && ! in_array($asset->object_key, $keys, true) && $disk->exists($asset->object_key)) {
            $keys[] = $asset->object_key;
        }
        foreach ($keys as $key) {
            $disk->delete($key);
        }
    }

    public function unpublish(CmsBanner $banner): RedirectResponse
    {
        $banner->update(['published' => false]);

        return redirect()->route('admin.banners.index')->with('success', 'Promo dinonaktifkan.');
    }

    public function publish(CmsBanner $banner): RedirectResponse
    {
        $banner->update(['published' => true]);

        return redirect()->route('admin.banners.index')->with('success', 'Promo diaktifkan.');
    }

    public function updateAutoPromotions(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'max_slides' => ['nullable', 'integer', 'min:1', 'max:8'],
        ]);

        HomepagePromotionSettings::update([
            'enabled' => $validated['enabled'],
            'max_slides' => $validated['max_slides'] ?? HomepagePromotionSettings::DEFAULTS['max_slides'],
        ], $request->user()?->id);

        return redirect()->route('admin.banners.index')->with('success', 'Pengaturan banner otomatis disimpan.');
    }

    /**
     * Validasi field non-gambar. Resolusi sumber gambar ditangani
     * resolveBannerImage() (upload langsung presigned / file legacy / link produk).
     *
     * @return array{title: ?string, link_url: ?string, sort_order: int, published: bool}
     */
    private function validateBanner(Request $request, bool $requireImage, ?CmsBanner $existing = null): array
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:64'],
            'link_url' => [
                'nullable',
                'string',
                'max:2048',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value && ! str_starts_with($value, '/') && ! filter_var($value, FILTER_VALIDATE_URL)) {
                        $fail('Link promo harus berupa URL penuh atau path internal seperti /product/SKU.');
                    }
                },
            ],
            'sort_order' => ['nullable', 'integer'],
            'published' => ['boolean'],
            'image' => ['nullable', 'file', 'image', 'max:10240'],
            'object_key' => ['nullable', 'string', 'max:255'],
        ]);

        return [
            'title' => $validated['title'] ?? null,
            'link_url' => $validated['link_url'] ?? null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'published' => $request->boolean('published'),
        ];
    }

    /**
     * Resolusi gambar banner: utamakan upload langsung (object_key hasil presign),
     * lalu file legacy, lalu gambar produk dari link, lalu gambar lama.
     *
     * @return array{image_url: string, media_asset_id: ?int}
     */
    private function resolveBannerImage(Request $request, ?CmsBanner $existing, bool $requireImage): array
    {
        // 1) Upload langsung browser -> R2 (presigned PUT): object pending + job WebP async.
        if ($request->filled('object_key')) {
            $key = (string) $request->input('object_key');
            $disk = Storage::disk(config('media.disk', 'media'));
            if (! str_starts_with($key, 'pending/') || ! $disk->exists($key)) {
                throw ValidationException::withMessages([
                    'image' => 'File upload tidak ditemukan. Silakan unggah ulang.',
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

            // Ganti gambar lama: arsipkan asset banner sebelumnya.
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

        // 2) Alur legacy: file langsung dari request (bukan presign).
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $name = MediaNamer::onDisk('banner', $file->getClientOriginalExtension() ?: 'png', 'media', 'banners');
            $path = $file->storeAs('banners', $name, 'media');
            $oldAssetId = $existing?->media_asset_id;
            if ($oldAssetId) {
                MediaAsset::where('id', $oldAssetId)
                    ->where('status', '!=', 'archived')
                    ->update(['status' => 'archived']);
            }

            return [
                'image_url' => Storage::disk('media')->url($path),
                'media_asset_id' => $oldAssetId ? null : $existing?->media_asset_id,
            ];
        }

        // 3) Gambar dari link produk / gambar lama / wajib ada.
        $imageUrl = $existing?->image_url
            ?: HomepagePromotions::productImageFromUrl($request->input('link_url') ?? $existing?->link_url);
        if (! $imageUrl && $requireImage) {
            throw ValidationException::withMessages([
                'image' => 'Unggah gambar atau isi link produk aktif yang memiliki gambar utama.',
            ]);
        }
        if (! $imageUrl) {
            throw ValidationException::withMessages([
                'image' => 'Gambar promo wajib ada. Unggah file baru atau pastikan link produk punya gambar utama.',
            ]);
        }

        return [
            'image_url' => $imageUrl,
            'media_asset_id' => $existing?->media_asset_id,
        ];
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

    /** @return array<string, mixed> */
    private function bannerCard(CmsBanner $banner): array
    {
        return [
            'id' => $banner->id,
            'title' => $banner->title,
            'image_url' => $banner->image_url,
            'media_asset_id' => $banner->media_asset_id,
            'link_url' => $banner->link_url,
            'sort_order' => (int) $banner->sort_order,
            'published' => (bool) $banner->published,
            'created_at' => optional($banner->created_at)?->toIso8601String(),
            'updated_at' => optional($banner->updated_at)?->toIso8601String(),
            'edit_href' => route('admin.banners.edit', $banner),
            'publish_url' => route('admin.banners.publish', $banner),
            'unpublish_url' => route('admin.banners.unpublish', $banner),
            'destroy_url' => route('admin.banners.destroy', $banner),
        ];
    }
}
