<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsGalleryItem;
use App\Models\CmsModelProduct;
use App\Models\CmsPage;
use App\Models\InstallationProject;
use App\Services\ActivityLogService;
use App\Support\InstallationPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InstallationGalleryController extends Controller
{
    public const STATUS_TABS = [
        ['key' => 'all', 'label' => 'Semua Hasil Pemasangan'],
        ['key' => 'active', 'label' => 'Hasil Pemasangan Aktif'],
        ['key' => 'inactive', 'label' => 'Hasil Pemasangan Nonaktif'],
        ['key' => 'archived', 'label' => 'Hasil Pemasangan Diarsipkan'],
    ];

    public function index(Request $request): Response
    {
        $status = (string) $request->query('status', 'all');
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'order');
        $view = (string) $request->query('view', 'list');

        $tabCounts = [
            'all' => InstallationProject::count(),
            'active' => InstallationProject::where('status', 'active')->count(),
            'inactive' => InstallationProject::where('status', 'inactive')->count(),
            'archived' => InstallationProject::where('status', 'archived')->count(),
        ];

        $tabs = collect(self::STATUS_TABS)->map(function (array $tab) use ($tabCounts) {
            return [
                'key' => $tab['key'],
                'label' => $tab['label'],
                'count' => $tabCounts[$tab['key']] ?? 0,
            ];
        })->values()->all();

        $query = InstallationProject::query()
            ->with(['modelProduct', 'mainImageAsset', 'mainVideoAsset']);

        if ($status !== 'all' && in_array($status, ['active', 'inactive', 'archived'], true)) {
            $query->where('status', $status);
        }

        if ($q !== '') {
            $query->where(function ($b) use ($q) {
                $b->where('title', 'like', "%{$q}%")
                    ->orWhere('category_label', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        if ($sort === 'latest') {
            $query->orderByDesc('created_at')->orderByDesc('id');
        } else {
            $query->orderBy('sort_order')->orderByDesc('id');
        }

        $projects = $query->paginate(15)->withQueryString()->through(function (InstallationProject $p) {
            return [
                'id' => $p->id,
                'title' => $p->title,
                'slug' => $p->slug,
                'category_label' => $p->category_label,
                'description' => $p->description,
                'status' => $p->status,
                'sort_order' => $p->sort_order,
                'main_image_url' => $p->resolvedMainImage(),
                'main_video_url' => $p->resolvedMainVideo(),
                'gallery_count' => is_array($p->gallery_images) ? count($p->gallery_images) : 0,
                'model_product' => $p->modelProduct ? [
                    'id' => $p->modelProduct->id,
                    'name' => $p->modelProduct->name,
                    'category' => $p->modelProduct->product_category,
                    'model' => $p->modelProduct->product_model,
                ] : null,
                'specifications' => $p->specifications ?? [],
                'created_at' => $p->created_at?->format('d M Y'),
                'showUrl' => route('admin.hasil-pemasangan.show', $p->id),
                'editUrl' => route('admin.hasil-pemasangan.edit', $p->id),
                'toggleStatusUrl' => route('admin.hasil-pemasangan.toggle-status', $p->id),
                'archiveUrl' => route('admin.hasil-pemasangan.archive', $p->id),
                'destroyUrl' => route('admin.hasil-pemasangan.destroy', $p->id),
            ];
        });

        return Inertia::render('Admin/InstallationGallery/Index', [
            'title' => 'Hasil Pemasangan',
            'description' => 'Portofolio proyek instalasi dan dokumentasi pemasangan produk di lokasi pelanggan.',
            'projects' => $projects,
            'tabs' => $tabs,
            'activeStatus' => $status,
            'viewMode' => in_array($view, ['list', 'grid'], true) ? $view : 'list',
            'sort' => $sort,
            'q' => $q,
            'createUrl' => route('admin.hasil-pemasangan.create'),
            'reorderUrl' => route('admin.hasil-pemasangan.reorder'),
            'previewUrl' => route('installation.index'),
        ]);
    }

    public function create(): Response
    {
        $modelProducts = CmsModelProduct::query()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'product_category', 'product_model']);

        return Inertia::render('Admin/InstallationGallery/Form', [
            'title' => 'Tambah Hasil Pemasangan',
            'project' => null,
            'modelProducts' => $modelProducts,
            'submitUrl' => route('admin.hasil-pemasangan.store'),
            'backUrl' => route('admin.hasil-pemasangan.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category_label' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'in:active,inactive,archived'],
            'description' => ['nullable', 'string'],
            'model_product_id' => ['nullable', 'integer', 'exists:cms_model_products,id'],
            'main_image_url' => ['nullable', 'string', 'max:1024'],
            'main_image_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'main_video_url' => ['nullable', 'string', 'max:1024'],
            'main_video_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'gallery_images' => ['nullable', 'array', 'max:3'],
            'gallery_images.*.url' => ['required', 'string', 'max:1024'],
            'gallery_images.*.asset_id' => ['nullable', 'integer'],
            'gallery_images.*.caption' => ['nullable', 'string', 'max:255'],
            'specifications' => ['nullable', 'array'],
            'specifications.*.name' => ['nullable', 'string', 'max:100'],
            'specifications.*.value' => ['nullable', 'string', 'max:255'],
        ]);

        if (empty($validated['main_image_url']) && empty($validated['main_image_asset_id'])) {
            return back()->withErrors(['main_image_url' => 'Foto utama wajib diunggah atau dipilih.'])->withInput();
        }

        $maxSort = (int) InstallationProject::max('sort_order');
        $slug = InstallationProject::generateUniqueSlug($validated['title']);

        $specs = collect($validated['specifications'] ?? [])
            ->filter(fn ($s) => !empty($s['name']) || !empty($s['value']))
            ->values()
            ->all();

        $project = InstallationProject::create([
            'title' => $validated['title'],
            'slug' => $slug,
            'category_label' => $validated['category_label'] ?? null,
            'status' => $validated['status'],
            'sort_order' => $maxSort + 1,
            'description' => $validated['description'] ?? null,
            'model_product_id' => $validated['model_product_id'] ?? null,
            'main_image_url' => $validated['main_image_url'] ?? null,
            'main_image_asset_id' => $validated['main_image_asset_id'] ?? null,
            'main_video_url' => $validated['main_video_url'] ?? null,
            'main_video_asset_id' => $validated['main_video_asset_id'] ?? null,
            'gallery_images' => $validated['gallery_images'] ?? [],
            'specifications' => $specs,
        ]);

        ActivityLogService::record('installation_project.created', 'installation_project', $project->id, ['title' => $project->title], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', "Proyek pemasangan \"{$project->title}\" berhasil dibuat.");
    }

    public function show(InstallationProject $project): Response
    {
        $project->load(['modelProduct', 'mainImageAsset', 'mainVideoAsset']);

        return Inertia::render('Admin/InstallationGallery/Show', [
            'title' => $project->title,
            'project' => [
                'id' => $project->id,
                'title' => $project->title,
                'slug' => $project->slug,
                'category_label' => $project->category_label,
                'description' => $project->description,
                'status' => $project->status,
                'sort_order' => $project->sort_order,
                'main_image_url' => $project->resolvedMainImage('pdp'),
                'main_video_url' => $project->resolvedMainVideo(),
                'gallery_images' => $project->gallery_images ?? [],
                'model_product' => $project->modelProduct ? [
                    'id' => $project->modelProduct->id,
                    'name' => $project->modelProduct->name,
                    'category' => $project->modelProduct->product_category,
                    'model' => $project->modelProduct->product_model,
                ] : null,
                'specifications' => $project->specifications ?? [],
                'created_at' => $project->created_at?->format('d M Y H:i'),
                'updated_at' => $project->updated_at?->format('d M Y H:i'),
                'editUrl' => route('admin.hasil-pemasangan.edit', $project->id),
                'toggleStatusUrl' => route('admin.hasil-pemasangan.toggle-status', $project->id),
                'archiveUrl' => route('admin.hasil-pemasangan.archive', $project->id),
                'destroyUrl' => route('admin.hasil-pemasangan.destroy', $project->id),
            ],
            'backUrl' => route('admin.hasil-pemasangan.index'),
        ]);
    }

    public function edit(InstallationProject $project): Response
    {
        $modelProducts = CmsModelProduct::query()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'product_category', 'product_model']);

        return Inertia::render('Admin/InstallationGallery/Form', [
            'title' => "Edit {$project->title}",
            'project' => [
                'id' => $project->id,
                'title' => $project->title,
                'slug' => $project->slug,
                'category_label' => $project->category_label,
                'status' => $project->status,
                'description' => $project->description,
                'model_product_id' => $project->model_product_id,
                'main_image_url' => $project->resolvedMainImage('pdp'),
                'main_image_asset_id' => $project->main_image_asset_id,
                'main_video_url' => $project->resolvedMainVideo(),
                'main_video_asset_id' => $project->main_video_asset_id,
                'gallery_images' => $project->gallery_images ?? [],
                'specifications' => $project->specifications ?? [],
            ],
            'modelProducts' => $modelProducts,
            'submitUrl' => route('admin.hasil-pemasangan.update', $project->id),
            'backUrl' => route('admin.hasil-pemasangan.index'),
        ]);
    }

    public function update(Request $request, InstallationProject $project): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category_label' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'in:active,inactive,archived'],
            'description' => ['nullable', 'string'],
            'model_product_id' => ['nullable', 'integer', 'exists:cms_model_products,id'],
            'main_image_url' => ['nullable', 'string', 'max:1024'],
            'main_image_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'main_video_url' => ['nullable', 'string', 'max:1024'],
            'main_video_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'gallery_images' => ['nullable', 'array', 'max:3'],
            'gallery_images.*.url' => ['required', 'string', 'max:1024'],
            'gallery_images.*.asset_id' => ['nullable', 'integer'],
            'gallery_images.*.caption' => ['nullable', 'string', 'max:255'],
            'specifications' => ['nullable', 'array'],
            'specifications.*.name' => ['nullable', 'string', 'max:100'],
            'specifications.*.value' => ['nullable', 'string', 'max:255'],
        ]);

        if (empty($validated['main_image_url']) && empty($validated['main_image_asset_id'])) {
            return back()->withErrors(['main_image_url' => 'Foto utama wajib diunggah atau dipilih.'])->withInput();
        }

        $specs = collect($validated['specifications'] ?? [])
            ->filter(fn ($s) => !empty($s['name']) || !empty($s['value']))
            ->values()
            ->all();

        $project->update([
            'title' => $validated['title'],
            'category_label' => $validated['category_label'] ?? null,
            'status' => $validated['status'],
            'description' => $validated['description'] ?? null,
            'model_product_id' => $validated['model_product_id'] ?? null,
            'main_image_url' => $validated['main_image_url'] ?? null,
            'main_image_asset_id' => $validated['main_image_asset_id'] ?? null,
            'main_video_url' => $validated['main_video_url'] ?? null,
            'main_video_asset_id' => $validated['main_video_asset_id'] ?? null,
            'gallery_images' => $validated['gallery_images'] ?? [],
            'specifications' => $specs,
        ]);

        ActivityLogService::record('installation_project.updated', 'installation_project', $project->id, ['title' => $project->title], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', "Proyek pemasangan \"{$project->title}\" berhasil diperbarui.");
    }

    public function toggleStatus(Request $request, InstallationProject $project): RedirectResponse
    {
        $newStatus = $project->status === 'active' ? 'inactive' : 'active';
        $project->update(['status' => $newStatus]);

        ActivityLogService::record('installation_project.status_toggled', 'installation_project', $project->id, ['status' => $newStatus], $request->user()?->id);

        $label = $newStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan';
        return back()->with('success', "Proyek \"{$project->title}\" berhasil {$label}.");
    }

    public function archive(Request $request, InstallationProject $project): RedirectResponse
    {
        $project->update(['status' => 'archived']);

        ActivityLogService::record('installation_project.archived', 'installation_project', $project->id, ['status' => 'archived'], $request->user()?->id);

        return back()->with('success', "Proyek \"{$project->title}\" berhasil diarsipkan.");
    }

    public function destroy(Request $request, InstallationProject $project): RedirectResponse
    {
        $title = $project->title;
        $project->delete();

        ActivityLogService::record('installation_project.deleted', 'installation_project', $project->id, ['title' => $title], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', "Proyek \"{$title}\" berhasil dihapus.");
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:installation_projects,id'],
            'rows.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['rows'] as $row) {
                InstallationProject::where('id', $row['id'])->update([
                    'sort_order' => $row['sort_order'],
                ]);
            }
        });

        ActivityLogService::record('installation_project.reordered', 'installation_project', (int) $validated['rows'][0]['id'], ['count' => count($validated['rows'])], $request->user()?->id);

        return back()->with('success', 'Urutan proyek hasil pemasangan berhasil disimpan.');
    }

    public function model(Request $request): RedirectResponse
    {
        return redirect()->route('admin.hasil-pemasangan.index');
    }

    public function updateMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:1000'],
            'published' => ['required', 'boolean'],
        ]);

        InstallationPageSettings::updatePageMeta($validated);

        ActivityLogService::record('installation_gallery.meta_updated', 'cms_page', 1, ['title' => $validated['title']], $request->user()?->id);

        return redirect()->route('admin.hasil-pemasangan.index')
            ->with('success', 'Pengaturan halaman hasil pemasangan diperbarui.');
    }
}
