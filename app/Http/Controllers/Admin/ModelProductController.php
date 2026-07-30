<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsModelProduct;
use App\Services\ActivityLogService;
use App\Services\ModelProductService;
use App\Support\CatalogLabels;
use App\Support\CatalogTaxonomy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ModelProductController extends Controller
{
    public function __construct(protected ModelProductService $models) {}

    public function index(Request $request): Response
    {
        $q = trim((string) $request->input('q', ''));
        $status = (string) $request->input('status', '');

        return Inertia::render('Admin/ModelProducts/Index', [
            'title' => 'Daftar Model Produk',
            'description' => 'Kelola model produk yang digunakan untuk mengelompokkan produk di toko.',
            'filters' => [
                'q' => $q,
                'status' => in_array($status, CmsModelProduct::STATUSES, true) ? $status : '',
            ],
            'statusOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => 'active', 'label' => 'Aktif'],
                ['value' => 'draft', 'label' => 'Draft'],
            ],
            'rows' => $this->models->adminRows(
                $q !== '' ? $q : null,
                in_array($status, CmsModelProduct::STATUSES, true) ? $status : null,
            ),
            'createHref' => route('admin.model-products.create'),
            'reorderUrl' => route('admin.model-products.reorder'),
            'syncUrl' => route('admin.model-products.sync'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/ModelProducts/Form', [
            'modelProduct' => null,
            'types' => CmsModelProduct::TYPES,
            'statuses' => CmsModelProduct::STATUSES,
            'categories' => $this->categoryOptions(),
            'models' => $this->modelOptions(),
            'submitUrl' => route('admin.model-products.store'),
            'indexUrl' => route('admin.model-products.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['sort_order'] = $validated['sort_order']
            ?? ((int) CmsModelProduct::query()->max('sort_order') + 1);

        $item = CmsModelProduct::create($validated);
        CatalogTaxonomy::forgetCache();

        ActivityLogService::record(
            'cms.model_product_created',
            'cms_model_product',
            (int) $item->id,
            ['name' => $item->name],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', 'Model produk ditambahkan.');
    }

    public function edit(CmsModelProduct $modelProduct): Response
    {
        return Inertia::render('Admin/ModelProducts/Form', [
            'modelProduct' => [
                'id' => $modelProduct->id,
                'name' => $modelProduct->name,
                'product_category' => $modelProduct->product_category,
                'product_model' => $modelProduct->product_model,
                'image_url' => $modelProduct->image_url,
                'description' => $modelProduct->description,
                'type' => $modelProduct->type,
                'status' => $modelProduct->status,
                'sort_order' => $modelProduct->sort_order,
            ],
            'types' => CmsModelProduct::TYPES,
            'statuses' => CmsModelProduct::STATUSES,
            'categories' => $this->categoryOptions(),
            'models' => $this->modelOptions(),
            'submitUrl' => route('admin.model-products.update', $modelProduct),
            'indexUrl' => route('admin.model-products.index'),
        ]);
    }

    public function update(Request $request, CmsModelProduct $modelProduct): RedirectResponse
    {
        $modelProduct->update($this->validated($request));
        CatalogTaxonomy::forgetCache();

        ActivityLogService::record(
            'cms.model_product_updated',
            'cms_model_product',
            (int) $modelProduct->id,
            ['name' => $modelProduct->name],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', 'Model produk diperbarui.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:cms_model_products,id'],
            'rows.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $this->models->reorder($validated['rows'], $request->user()?->id);

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', 'Urutan model produk disimpan.');
    }

    public function sync(Request $request): RedirectResponse
    {
        $created = $this->models->syncFromCatalog($request->user()?->id);

        return redirect()
            ->route('admin.model-products.index')
            ->with('success', $created > 0
                ? "Sinkronisasi selesai: {$created} model ditambahkan."
                : 'Semua model katalog sudah ada di daftar.');
    }

    public function activate(CmsModelProduct $modelProduct): RedirectResponse
    {
        $modelProduct->update(['status' => 'active']);
        CatalogTaxonomy::forgetCache();

        return back()->with('success', 'Model dipublikasikan.');
    }

    public function deactivate(CmsModelProduct $modelProduct): RedirectResponse
    {
        $modelProduct->update(['status' => 'draft']);
        CatalogTaxonomy::forgetCache();

        return back()->with('success', 'Model disembunyikan (draft).');
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', Rule::in(['WINDOW', 'DOOR', 'BOUVEN'])],
            'product_model' => ['nullable', 'string', 'max:64'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'description' => ['nullable', 'string', 'max:5000'],
            'type' => ['required', Rule::in(CmsModelProduct::TYPES)],
            'status' => ['required', Rule::in(CmsModelProduct::STATUSES)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $validated['product_category'] = $validated['product_category'] ?: null;
        $validated['product_model'] = CatalogLabels::normalizeModel($validated['product_model'] ?? null);
        $validated['image_url'] = $validated['image_url'] ?: null;
        $validated['description'] = filled($validated['description'] ?? null)
            ? trim((string) $validated['description'])
            : null;
        $validated['sort_order'] = isset($validated['sort_order']) ? (int) $validated['sort_order'] : null;

        return $validated;
    }

    /** @return list<array{value:string,label:string}> */
    protected function categoryOptions(): array
    {
        return [
            ['value' => 'WINDOW', 'label' => 'Jendela'],
            ['value' => 'DOOR', 'label' => 'Pintu'],
            ['value' => 'BOUVEN', 'label' => 'Boven'],
        ];
    }

    /** @return list<array{value:string,label:string}> */
    protected function modelOptions(): array
    {
        return collect(CatalogLabels::MODEL_ORDER)
            ->map(fn (string $code) => [
                'value' => $code,
                'label' => CatalogLabels::model($code),
            ])
            ->values()
            ->all();
    }
}
