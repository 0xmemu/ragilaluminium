<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Support\HomepageLayoutSettings;
use App\Support\HomepagePromotionSettings;
use App\Support\InertiaAdmin;
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
            HomepagePromotionSettings::mergePreservingAutoPromotions(
                \App\Support\CaraPemesananSettings::mergePreserving(
                    \App\Support\CmsDocumentSettings::mergePreserving(
                        $validated['content'] ?? null,
                        $page,
                    ),
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
        ]);

        if ($request->hasFile('logo')) {
            $file = $request->file('logo');
            $file->move(public_path('images'), 'site-logo.png');
        }

        if ($request->hasFile('favicon')) {
            $file = $request->file('favicon');
            $file->move(public_path('images'), 'site-favicon.ico');
        }

        return redirect()->route('admin.pages.index')->with('success', 'Branding berhasil diperbarui!');
    }
}
