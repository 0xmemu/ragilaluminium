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

    public function index(Request $request): Response
    {
        $q = trim((string) $request->input('q', ''));
        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['all', 'active', 'inactive'], true)) {
            $status = 'all';
        }

        $categories = Category::query()
            ->withCount('products')
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($sub) use ($q) {
                    $sub->where('name', 'like', "%{$q}%")
                        ->orWhere('code', 'like', "%{$q}%")
                        ->orWhere('slug', 'like', "%{$q}%");
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('is_active', false))
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
                'is_active' => (bool) $c->is_active,
                'products_count' => (int) $c->products_count,
                'editUrl' => route('admin.categories.edit', $c),
            ])->all();

        return Inertia::render('Admin/Categories/Index', [
            'title' => 'Kategori Produk',
            'description' => 'Kelola kategori produk yang tampil di katalog dan form produk.',
            'categories' => $categories,
            'filters' => [
                'q' => $q,
                'status' => $status,
            ],
            'statusOptions' => [
                ['value' => 'all', 'label' => 'Semua status'],
                ['value' => 'active', 'label' => 'Aktif'],
                ['value' => 'inactive', 'label' => 'Nonaktif'],
            ],
            'createUrl' => route('admin.categories.create'),
            'backUrl' => null,
        ]);
    }

    public function create(): Response
    {
        // Kontrak 2026-09-23: tambah dan edit kategori memakai pola yang sama,
        // yaitu halaman penuh. Sebelumnya tambah memakai panel popup di halaman
        // index sehingga dua alur berbeda untuk objek yang sama. Komponen
        // Admin/Categories/Form sudah menerima `category` bernilai null.
        return Inertia::render('Admin/Categories/Form', [
            'title' => 'Tambah Kategori',
            'description' => 'Buat kategori produk baru untuk katalog dan form produk.',
            'backUrl' => route('admin.categories.index'),
            'category' => null,
            'submitUrl' => route('admin.categories.store'),
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

        return redirect()->route('admin.categories.index')->with('success', 'Kategori "'.$category->name.'" berhasil dibuat.');
    }

    public function edit(Category $category): Response
    {
        return Inertia::render('Admin/Categories/Form', [
            'title' => 'Edit Kategori',
            'description' => 'Ubah data, struktur URL, dan optimasi SEO untuk kategori '.$category->name.'.',
            'backUrl' => route('admin.categories.index'),
            'category' => [
                'id' => $category->id,
                'code' => $category->code,
                'name' => $category->name,
                'slug' => $category->slug,
                'seo_title' => $category->seo_title,
                'seo_description' => $category->seo_description,
                'sort_order' => $category->sort_order,
                'is_active' => (bool) $category->is_active,
                'products_count' => $category->products()->count(),
                'public_url' => route('catalog.category', ['category' => $category->slug]),
                'products_url' => route('admin.products.index', [
                    'product_category' => CategoryUrl::codeToProductCode((string) $category->code),
                ]),
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

        return redirect()->route('admin.categories.index')->with('success', 'Kategori '.$category->name.' diperbarui.');
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
        // Kontrak 2026-09-24: kode kategori adalah kunci pencocokan
        // products.product_category. Bila kategori sudah dipakai produk, kode
        // tidak boleh berubah supaya relasi, angka katalog, dan URL publik
        // tidak patah. Form sudah menonaktifkan kolom ini; penjaga ini untuk
        // permintaan langsung. Dibaca dari permintaan, bukan dari hasil
        // penurunan kode, agar penjaga berdiri sendiri.
        if ($category && filled($request->input('code')) && $category->products()->exists()) {
            $requested = mb_strtoupper(preg_replace('/[^A-Za-z0-9_]/', '_', (string) $request->input('code')));
            if ($requested !== $category->code) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'code' => 'Kode kategori tidak bisa diubah karena sudah dipakai produk.',
                ]);
            }
        }

        $slugRule = ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'];
        if ($category) {
            $slugRule[] = 'unique:categories,slug,'.$category->id;
        } else {
            $slugRule[] = 'unique:categories,slug';
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50', 'unique:categories,code'.($category ? ','.$category->id : '')],
            'slug' => $slugRule,
            'seo_title' => ['nullable', 'string', 'max:191'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ], [], ['name' => 'Nama Kategori', 'code' => 'Kode Kategori']);

        // Kontrak 2026-09-16 (sama dgn Model Produk): tambah kategori berarti
        // MENAMBAH kategori baru dari nama. Admin TIDAK perlu mengisi atau memikirkan
        // kode kategori. Kode dibuat otomatis dari nama (huruf kapital underscore).
        $code = filled($data['code'] ?? null)
            ? mb_strtoupper(preg_replace('/[^A-Za-z0-9_]/', '_', (string) $data['code']))
            : ($category?->code ?? mb_strtoupper(Str::slug((string) $data['name'], '_')));

        // Pastikan kode unik bila baru dibuat
        if (! $category) {
            $baseCode = $code;
            $i = 1;
            while (Category::where('code', $code)->exists()) {
                $i++;
                $code = "{$baseCode}_{$i}";
            }
        }

        $slug = filled($data['slug'] ?? null)
            ? Str::slug((string) $data['slug'])
            : ($category?->slug ?? Str::slug((string) $data['name']));

        // Pastikan slug unik bila baru dibuat
        if (! $category) {
            $baseSlug = $slug;
            $i = 1;
            while (Category::where('slug', $slug)->exists()) {
                $i++;
                $slug = "{$baseSlug}-{$i}";
            }
        }

        $data['code'] = $code;
        $data['slug'] = $slug;
        $data['sort_order'] = isset($data['sort_order']) && $data['sort_order'] !== null
            ? (int) $data['sort_order']
            : ($category?->sort_order ?? ((int) Category::max('sort_order') + 1));
        $data['seo_title'] = filled($data['seo_title'] ?? null)
            ? trim((string) $data['seo_title'])
            : ($category?->seo_title ?? $data['name'].' Terbaik | Ragil Aluminium');
        $data['seo_description'] = filled($data['seo_description'] ?? null)
            ? trim((string) $data['seo_description'])
            : ($category?->seo_description ?? 'Koleksi produk '.$data['name'].' berkualitas tinggi dan bergaransi resmi dari Ragil Aluminium.');
        $data['is_active'] = $request->boolean('is_active', true);

        return $data;
    }
}
