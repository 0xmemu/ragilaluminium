<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SubModel;
use App\Services\ActivityLogService;
use App\Support\CatalogLabels;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SubModelController extends Controller
{
    public function index(Request $request): Response
    {
        $model = (string) $request->input('product_model', '');
        if (! in_array($model, SubModel::MODELS, true)) {
            $model = SubModel::MODELS[0];
        }

        $rows = SubModel::query()
            ->where('product_model', $model)
            ->withCount(['products as products_count' => fn ($q) => $q->where('status', 'active')])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Inertia::render('Admin/SubModels', [
            'title' => 'Sub Model',
            'description' => 'Daftar sub model per model produk; urutan di sini berlaku ke katalog website.',
            'activeModel' => $model,
            'modelOptions' => collect(SubModel::MODELS)
                ->map(fn (string $m) => ['value' => $m, 'label' => CatalogLabels::model($m)])
                ->all(),
            'rows' => $rows->map(fn (SubModel $s) => [
                'id' => $s->id,
                'code' => $s->code,
                'name' => $s->name,
                'description' => $s->description,
                'image_url' => $s->image_url,
                'sort_order' => $s->sort_order,
                'is_active' => $s->is_active,
                'products_count' => (int) ($s->products_count ?? 0),
                'edit_href' => route('admin.sub-models.edit', $s),
                'toggle_url' => route('admin.sub-models.toggle', $s),
            ])->values()->all(),
            'createHref' => route('admin.sub-models.create', ['product_model' => $model]),
            'reorderUrl' => route('admin.sub-models.reorder'),
        ]);
    }

    public function create(Request $request): Response
    {
        $model = (string) $request->input('product_model', '');
        if (! in_array($model, SubModel::MODELS, true)) {
            $model = SubModel::MODELS[0];
        }

        return Inertia::render('Admin/SubModelForm', [
            'title' => 'Tambah Sub Model',
            'subModel' => null,
            'productModel' => $model,
            'modelOptions' => collect(SubModel::MODELS)
                ->map(fn (string $m) => ['value' => $m, 'label' => CatalogLabels::model($m)])
                ->all(),
            'submitUrl' => route('admin.sub-models.store'),
            'indexUrl' => route('admin.sub-models.index', ['product_model' => $model]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'code' => self::normalizeCode((string) $request->input('code', '')),
        ]);

        $validated = $request->validate([
            'product_model' => ['required', 'in:'.implode(',', SubModel::MODELS)],
            'code' => ['required', 'string', 'max:100', 'regex:/^[A-Z0-9_]+$/', Rule::unique('sub_models', 'code')->where('product_model', $request->input('product_model'))],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'url', 'max:1024'],
        ], [
            'code.unique' => 'Kode sub model sudah dipakai untuk model ini.',
        ]);

        $validated['sort_order'] = (int) SubModel::query()
            ->where('product_model', $validated['product_model'])
            ->max('sort_order') + 10;
        $validated['is_active'] = true;

        $subModel = SubModel::create($validated);

        ActivityLogService::record('product.sub_model_created', 'sub_model', $subModel->id, [
            'product_model' => $subModel->product_model,
            'code' => $subModel->code,
            'name' => $subModel->name,
        ], $request->user()?->id);

        return redirect()->route('admin.sub-models.index', ['product_model' => $validated['product_model']])
            ->with('success', 'Sub model "'.$subModel->name.'" ditambahkan.');
    }

    public function edit(Request $request, SubModel $subModel): Response
    {
        return Inertia::render('Admin/SubModelForm', [
            'title' => 'Edit Sub Model',
            'subModel' => [
                'id' => $subModel->id,
                'product_model' => $subModel->product_model,
                'code' => $subModel->code,
                'name' => $subModel->name,
                'description' => $subModel->description,
                'image_url' => $subModel->image_url,
                'is_active' => $subModel->is_active,
            ],
            'productModel' => $subModel->product_model,
            'modelOptions' => collect(SubModel::MODELS)
                ->map(fn (string $m) => ['value' => $m, 'label' => CatalogLabels::model($m)])
                ->all(),
            'submitUrl' => route('admin.sub-models.update', $subModel),
            'indexUrl' => route('admin.sub-models.index', ['product_model' => $subModel->product_model]),
        ]);
    }

    public function update(Request $request, SubModel $subModel): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'url', 'max:1024'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $validated['is_active'] = $request->boolean('is_active');
        $subModel->update($validated);

        ActivityLogService::record('product.sub_model_updated', 'sub_model', $subModel->id, [
            'name' => $subModel->name,
            'is_active' => $subModel->is_active,
        ], $request->user()?->id);

        return redirect()->route('admin.sub-models.index', ['product_model' => $subModel->product_model])
            ->with('success', 'Sub model diperbarui.');
    }

    public function toggle(Request $request, SubModel $subModel): RedirectResponse
    {
        $subModel->update(['is_active' => ! $subModel->is_active]);

        ActivityLogService::record('product.sub_model_toggled', 'sub_model', $subModel->id, [
            'name' => $subModel->name,
            'is_active' => $subModel->is_active,
        ], $request->user()?->id);

        return back()->with('success', 'Status sub model diubah.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:sub_models,id'],
            'rows.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        DB::transaction(function () use ($validated): void {
            foreach ($validated['rows'] as $row) {
                SubModel::whereKey($row['id'])->update(['sort_order' => $row['sort_order']]);
            }
        });

        ActivityLogService::record('product.sub_model_reordered', 'sub_model', (int) $validated['rows'][0]['id'], [
            'count' => count($validated['rows']),
        ], $request->user()?->id);

        return back()->with('success', 'Urutan sub model disimpan.');
    }

    private static function normalizeCode(string $code): string
    {
        return strtoupper((string) preg_replace('/[\s\-]+/', '_', trim($code)));
    }
}
