<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Support\HomepageLayoutSettings;
use App\Support\InertiaAdmin;
use App\Support\MediaNamer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function index(): Response
    {
        $pages = CmsPage::latest()->paginate(20);

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Halaman CMS',
            'createHref' => route('admin.pages.create'),
            'columns' => [
                ['key' => 'title', 'label' => 'Judul', 'hrefKey' => 'href'],
                ['key' => 'slug', 'label' => 'Slug'],
                ['key' => 'published', 'label' => 'Published'],
                ['key' => 'updated_at', 'label' => 'Update'],
            ],
            'rows' => $pages->getCollection()->map(fn (CmsPage $p) => [
                'title' => $p->title,
                'slug' => $p->slug,
                'published' => $p->published ? 'ya' : 'tidak',
                'updated_at' => optional($p->updated_at)?->toDateTimeString(),
                'href' => route('admin.pages.edit', $p),
            ])->all(),
            'pagination' => InertiaAdmin::pagination($pages),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/CmsPageForm', [
            'backUrl' => route('admin.pages.index'),
            'page' => null,
            'submitUrl' => route('admin.pages.store'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'unique:cms_pages,slug'],
            'title' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'array'],
            'published' => ['boolean'],
        ]);
        $validated['published'] = $validated['published'] ?? false;
        $validated['updated_by_admin_id'] = $request->user()->id;

        CmsPage::create($validated);

        return redirect()->route('admin.pages.index')->with('success', 'Halaman dibuat.');
    }

    public function edit(CmsPage $page): Response
    {
        return Inertia::render('Admin/CmsPageForm', [
            'backUrl' => route('admin.pages.index'),
            'page' => [
                'id' => $page->id,
                'slug' => $page->slug,
                'title' => $page->title,
                'content' => $page->content,
                'published' => $page->published,
            ],
            'submitUrl' => route('admin.pages.update', $page),
        ]);
    }

    public function update(Request $request, CmsPage $page): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'array'],
            'published' => ['boolean'],
        ]);
        $validated['content'] = HomepageLayoutSettings::mergePreserving(
            \App\Support\CaraPemesananSettings::mergePreserving(
                \App\Support\CmsDocumentSettings::mergePreserving(
                    $validated['content'] ?? null,
                    $page,
                ),
                $page,
            ),
            $page,
        );
        $validated['published'] = $validated['published'] ?? false;
        $validated['updated_by_admin_id'] = $request->user()->id;
        $page->update($validated);

        return redirect()->route('admin.pages.index')->with('success', 'Halaman diperbarui.');
    }

    public function updateBranding(Request $request): RedirectResponse
    {
        $request->validate([
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp|max:5120',
            'favicon' => 'nullable|image|mimes:ico,png|max:2048',
            // Owner 2026-09-16: Media Library satu-satunya sumber aset.
            'logo_asset_id' => 'nullable|integer|exists:media_assets,id',
            'favicon_asset_id' => 'nullable|integer|exists:media_assets,id',
        ]);

        // Owner 2026-09-16: logo dari Media Library -> disalin ke file sistem.
        if ($request->filled('logo_asset_id')) {
            $asset = \App\Models\MediaAsset::query()
                ->where('status', 'ready')
                ->where('visibility', '!=', 'archived')
                ->findOrFail((int) $request->input('logo_asset_id'));
            $sourcePath = \Illuminate\Support\Facades\Storage::disk(config('media.disk', 'media'))->path($asset->object_key);
            copy($sourcePath, public_path('images/site-logo.png'));

            // Logo yang dipakai situs ada di images/brand/ (header desktop,
            // mobile, dan footer). Satu unggahan dipakai untuk kedua varian
            // tema; PNG transparan cocok untuk keduanya.
            foreach (['light-logo.png', 'dark-logo.png'] as $brandLogo) {
                $target = public_path('images/brand/'.$brandLogo);
                if (is_file($target)) {
                    @unlink($target);
                }
                if (! @copy(public_path('images/site-logo.png'), $target)) {
                    throw new \RuntimeException("Gagal memasang logo: {$target}. Periksa kepemilikan berkas (harus dapat ditulis www-data).");
                }
            }
        }

        // Owner 2026-09-16: favicon dari Media Library -> disalin ke file sistem.
        if ($request->filled('favicon_asset_id')) {
            $asset = \App\Models\MediaAsset::query()
                ->where('status', 'ready')
                ->where('visibility', '!=', 'archived')
                ->findOrFail((int) $request->input('favicon_asset_id'));
            $sourcePath = \Illuminate\Support\Facades\Storage::disk(config('media.disk', 'media'))->path($asset->object_key);
            copy($sourcePath, public_path('images/site-favicon.ico'));

            // Turunan PNG dipakai <head> untuk browser modern; tanpa ini PNG
            // lama tetap tampil walau favicon sudah diganti.
            app(\App\Support\FaviconWriter::class)
                ->sync(public_path('images/site-favicon.ico'));
        }

        return redirect()
            ->route('admin.store-settings.index', ['tab' => 'brand'])
            ->with('success', 'Branding berhasil diperbarui!');
    }
}
