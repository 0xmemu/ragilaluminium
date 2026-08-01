<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsBanner;
use App\Support\HomepagePromotions;
use App\Support\HomepagePromotionSettings;
use App\Support\InertiaAdmin;
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
                    $inner->where('title', 'like', "%{$q}%")
                        ->orWhere('link_url', 'like', "%{$q}%");
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
            'title' => 'Promo Toko',
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
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateBanner($request, requireImage: true);

        CmsBanner::create([
            'title' => $validated['title'] ?? null,
            'image_url' => $validated['image_url'],
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
        ]);
    }

    public function update(Request $request, CmsBanner $banner): RedirectResponse
    {
        $validated = $this->validateBanner($request, requireImage: false, existing: $banner);

        $banner->update([
            'title' => $validated['title'] ?? null,
            'image_url' => $validated['image_url'],
            'link_url' => $validated['link_url'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'published' => $validated['published'],
        ]);

        return redirect()->route('admin.banners.index')->with('success', 'Promo toko diperbarui.');
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
     * @return array{title: ?string, link_url: ?string, sort_order: int, published: bool, image_url: string}
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
        ]);

        $imageUrl = $existing?->image_url;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('banners', 'media');
            $imageUrl = Storage::disk('media')->url($path);
        }
        $imageUrl ??= HomepagePromotions::productImageFromUrl($validated['link_url'] ?? null);

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
            'title' => $validated['title'] ?? null,
            'link_url' => $validated['link_url'] ?? null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'published' => $request->boolean('published'),
            'image_url' => $imageUrl,
        ];
    }

    /** @return array<string, mixed> */
    private function bannerCard(CmsBanner $banner): array
    {
        return [
            'id' => $banner->id,
            'title' => $banner->title,
            'image_url' => $banner->image_url,
            'link_url' => $banner->link_url,
            'sort_order' => (int) $banner->sort_order,
            'published' => (bool) $banner->published,
            'created_at' => optional($banner->created_at)?->toIso8601String(),
            'updated_at' => optional($banner->updated_at)?->toIso8601String(),
            'edit_href' => route('admin.banners.edit', $banner),
            'publish_url' => route('admin.banners.publish', $banner),
            'unpublish_url' => route('admin.banners.unpublish', $banner),
        ];
    }
}
