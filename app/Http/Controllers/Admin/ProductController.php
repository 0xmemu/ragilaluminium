<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\CatalogLabels;
use App\Support\InertiaAdmin;
use App\Support\ShopeeStyleSku;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        $view = $request->input('view') === 'grid' ? 'grid' : 'list';
        $category = (string) $request->input('product_category', 'all');
        $model = (string) $request->input('product_model', 'all');
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));

        $products = Product::query()
            ->with(['mainImage', 'activeVariants'])
            ->withCount([
                'variants as variants_count',
                'activeVariants as active_variants_count',
            ])
            ->withSum('activeVariants as stock_total', 'stock')
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('name', 'like', "%{$q}%")
                        ->orWhere('short_name', 'like', "%{$q}%")
                        ->orWhere('parent_sku', 'like', "%{$q}%");
                });
            })
            ->when(
                $category !== '' && $category !== 'all',
                fn ($query) => $query->where('product_category', strtoupper($category))
            )
            ->when(
                $model !== '' && $model !== 'all',
                fn ($query) => $query->where('product_model', CatalogLabels::normalizeModel($model) ?? $model)
            )
            ->when(
                $status !== '' && $status !== 'all',
                fn ($query) => $query->where('status', $status)
            )
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Products/Index', [
            'title' => 'Daftar Produk',
            'description' => 'Kelola katalog produk, status, serta Import & Media dari menu Produk.',
            'viewMode' => $view,
            'searchQuery' => $q,
            'filters' => [
                'product_category' => $category === '' ? 'all' : $category,
                'product_model' => $model === '' ? 'all' : $model,
                'status' => $status === '' ? 'all' : $status,
            ],
            'filterOptions' => $this->listFilterOptions(),
            'products' => $products->getCollection()->map(fn (Product $p) => $this->productCard($p))->values()->all(),
            'pagination' => InertiaAdmin::pagination($products),
            'createHref' => route('admin.products.create'),
            'exportUrl' => route('admin.products.export', $request->query()),
            'importHref' => route('admin.imports.index'),
            'mediaHref' => route('admin.media.index'),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $category = (string) $request->input('product_category', 'all');
        $model = (string) $request->input('product_model', 'all');
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));

        $query = Product::query()
            ->withCount('variants as variants_count')
            ->withSum('activeVariants as stock_total', 'stock')
            ->when($q !== '', function ($builder) use ($q) {
                $builder->where(function ($inner) use ($q) {
                    $inner->where('name', 'like', "%{$q}%")
                        ->orWhere('parent_sku', 'like', "%{$q}%");
                });
            })
            ->when($category !== '' && $category !== 'all', fn ($builder) => $builder->where('product_category', strtoupper($category)))
            ->when(
                $model !== '' && $model !== 'all',
                fn ($builder) => $builder->where('product_model', CatalogLabels::normalizeModel($model) ?? $model)
            )
            ->when($status !== '' && $status !== 'all', fn ($builder) => $builder->where('status', $status))
            ->latest();

        $filename = 'produk-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'parent_sku',
                'name',
                'product_category',
                'product_model',
                'design_variant',
                'status',
                'min_price',
                'stock_total',
                'variants_count',
                'updated_at',
            ]);

            $query->chunk(200, function ($products) use ($handle) {
                foreach ($products as $product) {
                    fputcsv($handle, [
                        $product->parent_sku,
                        $product->name,
                        $product->product_category,
                        $product->product_model,
                        $product->design_variant,
                        $product->status,
                        $product->min_price,
                        $product->stock_total,
                        $product->variants_count,
                        optional($product->updated_at)?->toDateTimeString(),
                    ]);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/ProductForm', [
            'product' => null,
            'submitUrl' => route('admin.products.store'),
            'options' => $this->formOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer'],
            'product_category' => ['required', 'in:WINDOW,DOOR,BOUVEN'],
            'product_model' => ['required', 'in:JUNGKIT,SLIDING,SWING,KACA_MATI,ZIGZAG'],
            'design_variant' => ['required', 'in:POLOS,ORNAMEN,KOMBINASI,SERIES_A,SERIES_B,SERIES_C'],
            'status' => ['required', 'in:active,inactive,archived,draft'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'create_initial_variant' => ['sometimes', 'boolean'],
            'initial_price' => ['nullable', 'required_if:create_initial_variant,true', 'numeric', 'min:0'],
            'initial_stock' => ['nullable', 'required_if:create_initial_variant,true', 'integer', 'min:0'],
        ]);
        $createInitialVariant = $request->boolean('create_initial_variant');
        $initialVariant = [
            'price' => $validated['initial_price'] ?? null,
            'stock' => $validated['initial_stock'] ?? null,
        ];
        unset(
            $validated['create_initial_variant'],
            $validated['initial_price'],
            $validated['initial_stock'],
        );
        $validated['homepage_popular'] = $request->boolean('homepage_popular');
        $validated['homepage_popular_sort'] = (int) ($validated['homepage_popular_sort'] ?? 0);
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        $product = null;
        DB::transaction(function () use ($validated, $createInitialVariant, $initialVariant, $request, &$product): void {
            $product = Product::create([
                ...$validated,
                'parent_sku' => ShopeeStyleSku::nextParentSku(),
            ]);

            if ($createInitialVariant) {
                ProductVariant::create([
                    'product_id' => $product->id,
                    'variant_sku' => ShopeeStyleSku::nextVariantSku($product),
                    'price' => $initialVariant['price'],
                    'stock' => $initialVariant['stock'],
                    'status' => 'active',
                    'created_by_user_id' => $request->user()->id,
                    'updated_by_user_id' => $request->user()->id,
                ]);
            }
        });

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk berhasil dibuat dengan SKU '.$product->parent_sku.'.');
    }

    public function show(Product $product): Response
    {
        $product->load(['variants', 'attributes', 'media']);

        return Inertia::render('Admin/Products/Show', [
            'title' => $product->name,
            'subtitle' => $product->parent_sku,
            'fields' => [
                ['label' => 'Parent SKU', 'value' => $product->parent_sku],
                ['label' => 'Nama', 'value' => $product->name],
                ['label' => 'Nama Pendek', 'value' => $product->short_name],
                ['label' => 'Kategori', 'value' => $product->product_category],
                ['label' => 'Model', 'value' => $product->product_model],
                ['label' => 'Desain', 'value' => $product->design_variant],
                ['label' => 'Status', 'value' => $product->status],
                ['label' => 'Home Paling Banyak Dipesan', 'value' => $product->homepage_popular ? 'Ya (urut '.$product->homepage_popular_sort.')' : 'Tidak'],
                ['label' => 'Harga Min', 'value' => $product->min_price !== null ? number_format($product->min_price, 0, ',', '.') : null],
            ],
            'sections' => [
                [
                    'title' => 'Varian',
                    'rows' => $product->variants->map(fn ($v) => [
                        'label' => $v->variant_sku,
                        'value' => ($v->status ?? '-').' · Rp '.number_format((float) $v->price, 0, ',', '.'),
                    ])->values()->all(),
                ],
                [
                    'title' => 'Atribut',
                    'rows' => $product->attributes->map(fn ($a) => [
                        'label' => $a->attribute_name,
                        'value' => (string) $a->attribute_value,
                    ])->values()->all(),
                ],
                [
                    'title' => 'Media',
                    'rows' => $product->media->map(fn ($m) => [
                        'label' => '#'.$m->position.($m->is_main_image ? ' (utama)' : ''),
                        'value' => ($m->status ?? '-').' · '.($m->visibility ?? '-'),
                    ])->values()->all(),
                ],
            ],
            'editHref' => route('admin.products.edit', $product),
            'managementLinks' => [
                ['label' => 'Kelola varian', 'href' => route('admin.products.variants.index', $product), 'kind' => 'variants'],
                ['label' => 'Kelola atribut', 'href' => route('admin.products.attributes.index', $product), 'kind' => 'attributes'],
                ['label' => 'Kelola media', 'href' => route('admin.products.media.byProduct', $product), 'kind' => 'media'],
                ['label' => 'Bulk via Import', 'href' => route('admin.imports.index'), 'kind' => 'import'],
            ],
        ]);
    }

    public function edit(Product $product): Response
    {
        return Inertia::render('Admin/ProductForm', [
            'product' => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $product->name,
                'short_name' => $product->short_name,
                'description' => $product->description,
                'category_id' => $product->category_id,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
                'design_variant' => $product->design_variant,
                'status' => $product->status,
                'homepage_popular' => $product->homepage_popular,
                'homepage_popular_sort' => $product->homepage_popular_sort,
            ],
            'submitUrl' => route('admin.products.update', $product),
            'options' => $this->formOptions(),
        ]);
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer'],
            'product_category' => ['required', 'in:WINDOW,DOOR,BOUVEN'],
            'product_model' => ['required', 'in:JUNGKIT,SLIDING,SWING,KACA_MATI,ZIGZAG'],
            'design_variant' => ['required', 'in:POLOS,ORNAMEN,KOMBINASI,SERIES_A,SERIES_B,SERIES_C'],
            'status' => ['required', 'in:active,inactive,archived,draft'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);
        $validated['homepage_popular'] = $request->boolean('homepage_popular');
        $validated['homepage_popular_sort'] = (int) ($validated['homepage_popular_sort'] ?? 0);
        $validated['updated_by_user_id'] = $request->user()->id;
        $product->update($validated);

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk berhasil diperbarui.');
    }

    public function archive(Product $product): RedirectResponse
    {
        $product->update(['status' => 'archived']);

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk diarsipkan.');
    }

    public function unarchive(Product $product): RedirectResponse
    {
        $product->update(['status' => 'active']);

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk dipulihkan.');
    }

    /** @return array<string, mixed> */
    private function productCard(Product $product): array
    {
        $minPrice = $product->relationLoaded('activeVariants')
            ? $product->activeVariants->min('price')
            : $product->min_price;

        return [
            'id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'short_name' => $product->short_name,
            'product_category' => $product->product_category,
            'product_category_label' => CatalogLabels::category($product->product_category),
            'product_model' => $product->product_model,
            'product_model_label' => CatalogLabels::model($product->product_model),
            'design_variant' => $product->design_variant,
            'design_variant_label' => CatalogLabels::design($product->design_variant),
            'status' => $product->status,
            'min_price' => $minPrice !== null ? (float) $minPrice : null,
            'stock_total' => (int) ($product->stock_total ?? 0),
            'variants_count' => (int) ($product->variants_count ?? 0),
            'active_variants_count' => (int) ($product->active_variants_count ?? 0),
            'image' => $product->mainImage?->urlFor('card'),
            'updated_at' => optional($product->updated_at)?->toIso8601String(),
            'href' => route('admin.products.show', $product),
            'edit_href' => route('admin.products.edit', $product),
            'variants_href' => route('admin.products.variants.index', $product),
            'media_href' => route('admin.products.media.byProduct', $product),
            'archive_url' => route('admin.products.archive', $product),
            'unarchive_url' => route('admin.products.unarchive', $product),
            'public_href' => route('product.show', $product->parent_sku),
        ];
    }

    /** @return array<string, mixed> */
    private function listFilterOptions(): array
    {
        return [
            'categories' => [
                ['value' => 'all', 'label' => 'Semua kategori'],
                ...collect(['WINDOW', 'DOOR', 'BOUVEN'])
                    ->map(fn (string $value) => ['value' => $value, 'label' => CatalogLabels::category($value)])
                    ->all(),
            ],
            'models' => [
                ['value' => 'all', 'label' => 'Semua model'],
                ...collect(CatalogLabels::modelCodes())
                    ->map(fn (string $value) => ['value' => $value, 'label' => CatalogLabels::model($value)])
                    ->all(),
            ],
            'statuses' => [
                ['value' => 'all', 'label' => 'Semua status'],
                ['value' => 'active', 'label' => 'Aktif'],
                ['value' => 'inactive', 'label' => 'Nonaktif'],
                ['value' => 'draft', 'label' => 'Draft'],
                ['value' => 'archived', 'label' => 'Diarsipkan'],
            ],
        ];
    }

    private function formOptions(): array
    {
        return [
            'categories' => collect(['WINDOW', 'DOOR', 'BOUVEN'])
                ->map(fn (string $value) => ['value' => $value, 'label' => CatalogLabels::category($value)])
                ->all(),
            'models' => collect(CatalogLabels::modelCodes())
                ->map(fn (string $value) => ['value' => $value, 'label' => CatalogLabels::model($value)])
                ->all(),
            'designs' => collect(CatalogLabels::designCodes())
                ->map(fn (string $value) => ['value' => $value, 'label' => CatalogLabels::design($value)])
                ->all(),
            'statuses' => collect(['active', 'inactive', 'archived', 'draft'])
                ->map(fn (string $value) => ['value' => $value, 'label' => $value])
                ->all(),
        ];
    }
}
