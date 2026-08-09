<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Support\CatalogLabels;
use App\Support\ExportSafety;
use App\Support\InertiaAdmin;
use App\Support\ShopeeStyleSku;
use App\Services\ActivityLogService;
use App\Services\ProductPublicationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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
        $size = $q !== '' ? $this->parseSizeQuery($q) : null;


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
            ->when($size !== null, function ($query) use ($size) {
                [$a, $b, $depth] = $size;
                $query->whereHas('activeVariants', function ($variantQuery) use ($a, $b, $depth) {
                    $variantQuery->where(function ($pair) use ($a, $b, $depth) {
                        $pair->where('width_cm', $a)->where('height_cm', $b);
                        if ($depth !== null) {
                            $pair->where('depth_cm', $depth);
                        }
                    })->orWhere(function ($pair) use ($a, $b, $depth) {
                        $pair->where('width_cm', $b)->where('height_cm', $a);
                        if ($depth !== null) {
                            $pair->where('depth_cm', $depth);
                        }
                    });
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
            ->paginate(14)
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

        ExportSafety::assertQueryWithinLimit($query);

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            ExportSafety::writeCsvRow($handle, [
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
                    ExportSafety::writeCsvRow($handle, [
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
            'workflow' => ['nullable', 'in:wizard'],
            'name' => ['required', 'string', 'max:255', Rule::unique('products', 'name')],
            'short_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer'],
            'product_category' => ['required', 'in:WINDOW,DOOR,BOUVEN'],
            'product_model' => ['required', 'in:JUNGKIT,SLIDING,SWING,KACA_MATI,ZIGZAG'],
            'design_variant' => ['nullable', 'string', 'max:100', Rule::exists('sub_models', 'code')->where('product_model', $request->input('product_model'))],
            'status' => ['required', 'in:active,archived'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'create_initial_variant' => ['sometimes', 'boolean'],
            'initial_price' => ['nullable', 'required_if:create_initial_variant,true', 'numeric', 'min:0'],
            'initial_stock' => ['nullable', 'required_if:create_initial_variant,true', 'integer', 'min:0'],
        ]);
        $wizard = $request->input('workflow') === 'wizard';
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

        if ($wizard) {
            return redirect()->route('admin.products.edit', [
                'product' => $product,
                'step' => 'variants',
            ])->with('success', 'Draft produk dibuat. Lanjutkan dengan varian.');
        }

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
        $product->load(['variants', 'media']);

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
            'publishUrl' => route('admin.products.publish', $product),
            'variantBulkUrl' => route('admin.products.variants.bulk', $product),
            'mediaHref' => route('admin.products.media.byProduct', $product),
            'wizardStep' => in_array($requestStep = request()->query('step'), ['identity', 'variants', 'media', 'review'], true)
                ? $requestStep
                : 'identity',
            'variants' => $product->variants->map(fn (ProductVariant $variant) => [
                'id' => $variant->id,
                'variant_sku' => $variant->variant_sku,
                'variation_1_name' => $variant->variation_1_name,
                'variation_1_option' => $variant->variation_1_option,
                'variation_2_name' => $variant->variation_2_name,
                'variation_2_option' => $variant->variation_2_option,
                'price' => (float) $variant->price,
                'stock' => (int) $variant->stock,
                'status' => $variant->status,
            ])->values()->all(),
            'completion' => [
                'active_variants' => $product->variants->where('status', 'active')->count(),
                'main_image_ready' => $product->media->contains(fn ($media) =>
                    $media->is_main_image
                    && $media->show_in_catalog
                    && $media->visibility === 'visible'
                    && $media->status === 'downloaded'
                ),
            ],
            'options' => $this->formOptions(),
        ]);
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('products', 'name')->ignore($product->id)],
            'short_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer'],
            'product_category' => ['required', 'in:WINDOW,DOOR,BOUVEN'],
            'product_model' => ['required', 'in:JUNGKIT,SLIDING,SWING,KACA_MATI,ZIGZAG'],
            'design_variant' => ['nullable', 'string', 'max:100', Rule::exists('sub_models', 'code')->where('product_model', $request->input('product_model'))],
            'status' => ['required', 'in:active,archived'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'wizard_step' => ['nullable', 'in:identity,variants,media,review'],
        ]);
        $wizardStep = $validated['wizard_step'] ?? null;
        unset($validated['wizard_step']);
        $validated['homepage_popular'] = $request->boolean('homepage_popular');
        $validated['homepage_popular_sort'] = (int) ($validated['homepage_popular_sort'] ?? 0);
        $validated['updated_by_user_id'] = $request->user()->id;
        $product->update($validated);

        if ($wizardStep !== null) {
            return redirect()->route('admin.products.edit', [
                'product' => $product,
                'step' => $wizardStep,
            ])->with('success', 'Identitas produk disimpan.');
        }

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk berhasil diperbarui.');
    }

    public function duplicate(Request $request, Product $product): RedirectResponse
    {
        $copy = null;

        DB::transaction(function () use ($request, $product, &$copy): void {
            $copy = Product::create([
                'parent_sku' => ShopeeStyleSku::nextParentSku(),
                'name' => $product->name.' (Salinan)',
                'short_name' => $product->short_name,
                'description' => $product->description,
                'category_id' => $product->category_id,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
                'design_variant' => $product->design_variant,
                'status' => 'active',
                'homepage_popular' => false,
                'homepage_popular_sort' => 0,
                'created_by_user_id' => $request->user()->id,
                'updated_by_user_id' => $request->user()->id,
            ]);

            foreach ($product->variants as $variant) {
                ProductVariant::create([
                    'product_id' => $copy->id,
                    'variant_sku' => ShopeeStyleSku::nextVariantSku($copy),
                    'variation_1_name' => $variant->variation_1_name,
                    'variation_1_option' => $variant->variation_1_option,
                    'variation_2_name' => $variant->variation_2_name,
                    'variation_2_option' => $variant->variation_2_option,
                    'price' => $variant->price,
                    'stock' => 0,
                    'weight_kg' => $variant->weight_kg,
                    'width_cm' => $variant->width_cm,
                    'height_cm' => $variant->height_cm,
                    'depth_cm' => $variant->depth_cm,
                    'status' => 'active',
                    'created_by_user_id' => $request->user()->id,
                    'updated_by_user_id' => $request->user()->id,
                ]);
            }

            foreach ($product->attributes as $attribute) {
                ProductAttribute::create([
                    'product_id' => $copy->id,
                    'product_variant_id' => $attribute->product_variant_id,
                    'attribute_name' => $attribute->attribute_name,
                    'attribute_value' => $attribute->attribute_value,
                    'source' => $attribute->source,
                    'created_by_user_id' => $request->user()->id,
                    'updated_by_user_id' => $request->user()->id,
                ]);
            }
        });

        ActivityLogService::record('product.duplicated', 'product', $copy->id, [
            'from' => $product->id,
            'name' => $copy->name,
            'parent_sku' => $copy->parent_sku,
        ], (int) $request->user()->id);

        return redirect()->route('admin.products.edit', $copy)
            ->with('success', 'Produk disalin sebagai '.$copy->parent_sku.'. Lengkapi lalu simpan.');
    }

    public function publish(Request $request, Product $product, ProductPublicationService $publication): RedirectResponse
    {
        $publication->publish($product, (int) $request->user()->id);

        return redirect()->route('admin.products.show', $product)
            ->with('success', 'Produk dipublikasikan.');
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
            'duplicate_url' => route('admin.products.duplicate', $product),
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
                ['value' => 'archived', 'label' => 'Diarsipkan'],
            ],
        ];
    }

    /**
     * Parser pencarian ukuran: "100x50", "T100xP50", "Tinggi 100 Panjang 50".
     *
     * @return array{0: float, 1: float, 2: float|null}|null
     */
    private function parseSizeQuery(string $q): ?array
    {
        $normalized = mb_strtolower($q);
        $normalized = preg_replace('/\s*(x|×|:)\s*/', 'x', $normalized);
        $normalized = preg_replace('/(tinggi|panjang|lebar|dalam|t|p|l|x)\s*/i', ' ', $normalized);
        preg_match_all('/\d+(?:[.,]\d+)?/', $normalized, $matches);

        $numbers = array_values(array_filter(
            array_map(fn ($raw) => (float) str_replace(',', '.', $raw), $matches[0] ?? []),
            fn ($number) => $number > 0,
        ));

        if (count($numbers) < 2) {
            return null;
        }

        return [$numbers[0], $numbers[1], $numbers[2] ?? null];
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
            'designs' => \App\Models\SubModel::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(['product_model', 'code', 'name'])
                ->map(fn ($row) => ['value' => $row->code, 'label' => $row->name, 'model' => $row->product_model])
                ->all(),
            'statuses' => collect(['active', 'archived'])
                ->map(fn (string $value) => ['value' => $value, 'label' => $value])
                ->all(),
        ];
    }
}
