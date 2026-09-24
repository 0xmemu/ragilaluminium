<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SubModel;
use App\Services\ActivityLogService;
use App\Support\CatalogLabels;
use App\Support\InertiaAdmin;
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
        // Kontrak 2026-09-16: tanpa parameter valid, TIDAK ada model yang
        // terpilih otomatis (dulu jatuh ke MODELS[0] = JUNGKIT_1_DAUN).
        // Tanpa pilihan, daftar menampilkan seluruh sub model terurut per
        // model; mode geser urutan dinonaktifkan karena urutan per model.
        $q = trim((string) $request->input('q', ''));
        $model = (string) $request->input('product_model', '');
        $model = in_array($model, SubModel::MODELS, true) ? $model : null;

        // Filter status: semua, aktif, nonaktif (owner 2026-09-16)
        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['all', 'active', 'inactive'], true)) {
            $status = 'all';
        }

        // Ukuran halaman: hanya 20, 50, 100 yang diterima; nilai lain jatuh ke 20.
        $perPage = (int) $request->input('per_page', 20);
        if (! in_array($perPage, [20, 50, 100], true)) {
            $perPage = 20;
        }

        $baseQuery = SubModel::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($sub) use ($q) {
                    $sub->where('name', 'like', "%{$q}%")
                        ->orWhere('code', 'like', "%{$q}%")
                        ->orWhere('description', 'like', "%{$q}%");
                });
            })
            ->when($model, fn ($query) => $query->where('product_model', $model));

        $totalCount = (clone $baseQuery)->count();
        $activeCount = (clone $baseQuery)->where('is_active', true)->count();
        $inactiveCount = (clone $baseQuery)->where('is_active', false)->count();

        $rows = (clone $baseQuery)
            ->when($status === 'active', fn ($query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('is_active', false))
            ->withCount(['products as products_count' => fn ($q) => $q->where('status', 'active')])
            ->orderBy('product_model')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage)
            ->appends($request->query());

        return Inertia::render('Admin/SubModels', [
            'title' => 'Sub Model',
            'description' => 'Daftar sub model per model produk; urutan di sini berlaku ke katalog website.',
            'activeModel' => $model,
            'activeStatus' => $status,
            'perPage' => $perPage,
            'pagination' => InertiaAdmin::pagination($rows),
            'filters' => [
                'q' => $q,
                'product_model' => $model ?? '',
                'status' => $status,
            ],
            'statusOptions' => [
                ['value' => 'all', 'label' => 'Semua status'],
                ['value' => 'active', 'label' => 'Aktif'],
                ['value' => 'inactive', 'label' => 'Nonaktif'],
            ],
            'statusTabs' => [
                ['key' => 'all', 'label' => 'Semua', 'count' => $totalCount],
                ['key' => 'active', 'label' => 'Aktif', 'count' => $activeCount],
                ['key' => 'inactive', 'label' => 'Nonaktif', 'count' => $inactiveCount],
            ],
            'modelOptions' => array_merge(
                [['value' => '', 'label' => 'Semua model']],
                collect(SubModel::MODELS)
                    ->map(fn (string $m) => ['value' => $m, 'label' => CatalogLabels::model($m)])
                    ->all(),
            ),
            'rows' => $rows->getCollection()->map(fn (SubModel $s) => [
                'id' => $s->id,
                'product_model' => $s->product_model,
                'model_label' => CatalogLabels::model($s->product_model) ?: $s->product_model,
                'code' => $s->code,
                'name' => $s->name,
                'description' => $s->description,
                'sort_order' => $s->sort_order,
                'is_active' => $s->is_active,
                'products_count' => (int) ($s->products_count ?? 0),
                'edit_href' => route('admin.sub-models.edit', $s),
                'toggle_url' => route('admin.sub-models.toggle', $s),
            ])->values()->all(),
            'createHref' => $model
                ? route('admin.sub-models.create', ['product_model' => $model])
                : route('admin.sub-models.create'),
            'reorderUrl' => route('admin.sub-models.reorder'),
        ]);
    }

    public function create(Request $request): Response
    {
        // Kontrak 2026-09-16: form tambah SELALU kosong, admin memilih model
        // sendiri lewat pemilih bercari. Parameter valid hanya menentukan
        // tautan balik ke daftar, BUKAN mengisi form (jangan ulangi
        // kesalahan prefill MODELS[0] yang pernah diperbaiki di bcae2a6).
        $model = (string) $request->input('product_model', '');
        $model = in_array($model, SubModel::MODELS, true) ? $model : null;

        return Inertia::render('Admin/SubModelForm', [
            'backUrl' => route('admin.sub-models.index', $model ? ['product_model' => $model] : []),
            'title' => 'Tambah Sub Model',
            'subModel' => null,
            'modelOptions' => collect(SubModel::MODELS)
                ->map(fn (string $m) => ['value' => $m, 'label' => CatalogLabels::model($m)])
                ->all(),
            'submitUrl' => route('admin.sub-models.store'),
            'indexUrl' => route('admin.sub-models.index', $model ? ['product_model' => $model] : []),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $rawCode = (string) $request->input('code', '');
        $code = filled($rawCode)
            ? self::normalizeCode($rawCode)
            : self::normalizeCode(\Illuminate\Support\Str::slug((string) $request->input('name', ''), '_'));

        $request->merge(['code' => $code]);

        $validated = $request->validate([
            'product_model' => ['required', 'in:'.implode(',', SubModel::MODELS)],
            'code' => ['required', 'string', 'max:100', 'regex:/^[A-Z0-9_]+$/', Rule::unique('sub_models', 'code')->where('product_model', $request->input('product_model'))],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ], [
            'code.unique' => 'Kode sub model sudah dipakai untuk model ini.',
        ], ['product_model' => 'Model produk', 'code' => 'Kode', 'name' => 'Nama sub model']);

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
            'backUrl' => route('admin.sub-models.index'),
            'title' => 'Edit Sub Model',
            'subModel' => [
                'id' => $subModel->id,
                'product_model' => $subModel->product_model,
                'code' => $subModel->code,
                'name' => $subModel->name,
                'description' => $subModel->description,
                'is_active' => $subModel->is_active,
            ],
            'attributeTemplates' => $subModel->attributeTemplates()
                ->orderBy('sort_order')->orderBy('id')
                ->get(['id', 'attribute_name', 'attribute_value'])
                ->all(),
            'modelTemplates' => \App\Models\SubModelAttributeTemplate::query()
                ->whereNull('sub_model_id')
                ->where('product_model', $subModel->product_model)
                ->orderBy('sort_order')->orderBy('id')
                ->get(['id', 'attribute_name', 'attribute_value'])
                ->all(),
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
            'is_active' => ['sometimes', 'boolean'],
            'templates' => ['nullable', 'array', 'max:30'],
            'templates.*.attribute_name' => ['required_with:templates', 'string', 'max:100'],
            'templates.*.attribute_value' => ['required_with:templates', 'string', 'max:255'],
            'model_templates' => ['nullable', 'array', 'max:30'],
            'model_templates.*.attribute_name' => ['required_with:model_templates', 'string', 'max:100'],
            'model_templates.*.attribute_value' => ['required_with:model_templates', 'string', 'max:255'],
        ], [], ['name' => 'Nama sub model']);
        $validated['is_active'] = $request->boolean('is_active');
        $subModel->update($validated);

        // Template atribut (ADR-019): daftar dari form menggantikan template lama.
        $subModel->attributeTemplates()->delete();
        foreach ($request->input('templates', []) as $index => $templateRow) {
            $name = trim((string) ($templateRow['attribute_name'] ?? ''));
            $value = trim((string) ($templateRow['attribute_value'] ?? ''));
            if ($name === '' || $value === '') {
                continue;
            }
            \App\Models\SubModelAttributeTemplate::create([
                'sub_model_id' => $subModel->id,
                'product_model' => $subModel->product_model,
                'attribute_name' => $name,
                'attribute_value' => $value,
                'sort_order' => $index * 10,
            ]);
        }

        // Template DEFAULT MODEL (sub_model_id null) juga diganti dari form.
        \App\Models\SubModelAttributeTemplate::query()
            ->whereNull('sub_model_id')
            ->where('product_model', $subModel->product_model)
            ->delete();
        foreach ($request->input('model_templates', []) as $index => $templateRow) {
            $name = trim((string) ($templateRow['attribute_name'] ?? ''));
            $value = trim((string) ($templateRow['attribute_value'] ?? ''));
            if ($name === '' || $value === '') {
                continue;
            }
            \App\Models\SubModelAttributeTemplate::create([
                'sub_model_id' => null,
                'product_model' => $subModel->product_model,
                'attribute_name' => $name,
                'attribute_value' => $value,
                'sort_order' => $index * 10,
            ]);
        }

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
