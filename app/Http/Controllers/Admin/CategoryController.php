<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\CatalogTaxonomy;
use App\Support\CategoryUrl;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function __construct(protected ActivityLogService $logs) {}

    public function index(): Response
    {
        $categories = Category::query()
            ->withCount('products')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (Category $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'slug' => $c->slug,
                'seo_title' => $c->seo_title,
                'sort_order' => $c->sort_order,
                'is_active' => $c->is_active,
                'products_count' => $c->products_count,
                'editUrl' => route('admin.categories.edit', $c),
            ])->all();

        return Inertia::render('Admin/Categories/Index', [
            'title' => 'Kategori Produk',
            'description' => 'Kelola kategori produk yang tampil di katalog dan form produk.',
            'categories' => $categories,
            'createHref' => route('admin.categories.create'),
            'backUrl' => route('admin.products.index'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Categories/Form', [
            'title' => 'Tambah Kategori',
            'description' => 'Buat kategori produk baru.',
            'category' => null,
            'submitUrl' => route('admin.categories.store'),
            'backUrl' => route('admin.categories.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateCategory($request);
        $category = Category::create($data);
        $this->logs->record('product.category_created', 'category', $category->id, [
            'code' => $category->code,
            'name' => $category->name,
        ]);

        $this->flushTaxonomyCaches();

        return redirect()->route('admin.categories.edit', $category)->with('success', 'Kategori dibuat.');
    }

    public function edit(Category $category): Response
    {
        return Inertia::render('Admin/Categories/Form', [
            'title' => 'Edit Kategori',
            'description' => 'Ubah kategori produk.',
            'backUrl' => route('admin.categories.index'),
            'category' => [
                'id' => $category->id,
                'code' => $category->code,
                'name' => $category->name,
                'slug' => $category->slug,
                'seo_title' => $category->seo_title,
                'seo_description' => $category->seo_description,
                'sort_order' => $category->sort_order,
                'is_active' => $category->is_active,
            ],
            'submitUrl' => route('admin.categories.update', $category),
        ]);
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        $data = $this->validateCategory($request, $category);
        $category->update($data);
        $this->logs->record('product.category_updated', 'category', $category->id, [
            'code' => $category->code,
            'name' => $category->name,
        ]);

        $this->flushTaxonomyCaches();

        return redirect()->route('admin.categories.edit', $category)->with('success', 'Kategori diperbarui.');
    }

    public function destroy(Category $category): RedirectResponse
    {
        if ($category->products()->exists()) {
            return back()->with('error', 'Tidak bisa menghapus kategori yang masih dipakai produk.');
        }
        $this->logs->record('product.category_deleted', 'category', $category->id, [
            'code' => $category->code,
        ]);
        $category->delete();
        $this->flushTaxonomyCaches();

        return redirect()->route('admin.categories.index')->with('success', 'Kategori dihapus.');
    }

        protected function flushTaxonomyCaches(): void
    {
        CategoryUrl::forgetCache();
        CatalogTaxonomy::forgetCache();
    }

protected function validateCategory(Request $request, ?Category $category = null): array
    {
        $slugRule = ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'];
        if ($category) {
            $slugRule[] = 'unique:categories,slug,'.$category->id;
        } else {
            $slugRule[] = 'unique:categories,slug';
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:categories,code'.($category ? ','.$category->id : '')],
            'name' => ['required', 'string', 'max:100'],
            'slug' => $slugRule,
            'seo_title' => ['nullable', 'string', 'max:191'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $data['slug'] = $data['slug'] ?: Str::slug($data['name']);
        $data['sort_order'] = $data['sort_order'] ?? 0;
        $data['is_active'] = $request->boolean('is_active');

        return $data;
    }
}
