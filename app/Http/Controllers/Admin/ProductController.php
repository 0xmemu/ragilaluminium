<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\ProductMedia;
use App\Support\CatalogLabels;
use App\Support\CategoryUrl;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ProductExport;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use App\Support\ShopeeStyleSku;
use App\Support\OperationalSettings;
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
        $view = 'list';
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
            ->withSum('validOrderItems as sold_count', 'quantity')
            ->withSum('activeVariants as stock_total', 'stock')
            ->when($q !== '' && $size === null, function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    LikeSearch::whereLike($inner, 'name', $q);
                    LikeSearch::orWhereLike($inner, 'short_name', $q);
                    LikeSearch::orWhereLike($inner, 'parent_sku', $q);
                });
            })
            ->when($size !== null, function ($query) use ($size) {
                [$a, $b, $depth] = $size;
                $query->whereHas('activeVariants', function ($variantQuery) use ($a, $b, $depth) {
                    $variantQuery->where(function ($pair) use ($a, $b, $depth) {
                        $pair->where('height_cm', $a)->where('width_cm', $b);
                        if ($depth !== null) {
                            $pair->where('depth_cm', $depth);
                        }
                    })->orWhere(function ($pair) use ($a, $b, $depth) {
                        $pair->where('height_cm', $b)->where('width_cm', $a);
                        if ($depth !== null) {
                            $pair->where('depth_cm', $depth);
                        }
                    });
                });
            })
            ->when(
                $category !== '' && $category !== 'all',
                fn ($query) => $query->where('product_category', CategoryUrl::codeToProductCode($category))
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
            'importPerformanceHref' => route('admin.analytics.import-performance'),
            'mediaHref' => route('admin.media.library'),
        ]);
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $category = (string) $request->input('product_category', 'all');
        $model = (string) $request->input('product_model', 'all');
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));

        $query = Product::query()
            ->withCount('variants as variants_count')
            ->withSum('validOrderItems as sold_count', 'quantity')
            ->withSum('activeVariants as stock_total', 'stock')
            ->when($q !== '', function ($builder) use ($q) {
                $builder->where(function ($inner) use ($q) {
                    LikeSearch::whereLike($inner, 'name', $q);
                    LikeSearch::orWhereLike($inner, 'parent_sku', $q);
                });
            })
            ->when($category !== '' && $category !== 'all', fn ($builder) => $builder->where('product_category', CategoryUrl::codeToProductCode($category)))
            ->when(
                $model !== '' && $model !== 'all',
                fn ($builder) => $builder->where('product_model', CatalogLabels::normalizeModel($model) ?? $model)
            )
            ->when($status !== '' && $status !== 'all', fn ($builder) => $builder->where('status', $status))
            ->latest();


        ExportSafety::assertQueryWithinLimit($query);

        return Excel::download(new ProductExport($query), 'produk-'.now()->format('Ymd-His').'.xlsx');

    }

    public function create(): Response
    {
        return Inertia::render('Admin/ProductForm', [
            'backUrl' => route('admin.products.index'),
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

            'description' => ['nullable', 'string'],
            'product_category' => ['required', Rule::in(array_merge(
                \App\Support\CategoryUrl::productCategoryCodes(),
                ['WINDOW', 'DOOR', 'BOUVEN'], // legacy data lama tetap valid
            ))],
            'product_model' => ['required', Rule::in(\App\Support\CatalogLabels::modelCodes())],
            'design_variant' => ['nullable', 'string', 'max:100', Rule::exists('sub_models', 'code')->where('product_model', $request->input('product_model'))],
            'status' => ['required', 'in:active,archived'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'create_initial_variant' => ['sometimes', 'boolean'],
            // ADR-020: media dipilih/diunggah langsung di form, dilampirkan setelah produk dibuat.
            'media_asset_ids' => ['nullable', 'array', 'max:20'],
            'media_asset_ids.*' => ['integer', Rule::exists('media_assets', 'id')->where('status', 'ready')],
            // ADR-021: dimensi/berat milik produk (kontrak J&T: kg + cm kubikasi).
            'weight_kg' => ['nullable', 'numeric', 'min:0'],
            'width_cm' => ['nullable', 'numeric', 'min:0'],
            'height_cm' => ['nullable', 'numeric', 'min:0'],
            'depth_cm' => ['nullable', 'numeric', 'min:0'],
            // ADR-021: definisi varian (nama bebas + daftar opsi).
            'variant_defs' => ['nullable', 'array', 'max:5'],
            'variant_defs.*.name' => ['required_with:variant_defs', 'string', 'max:100'],
            'variant_defs.*.options' => ['required_with:variant_defs', 'array', 'min:1', 'max:50'],
            'variant_defs.*.options.*.value' => ['required_with:variant_defs.*.options', 'string', 'max:255'],
            'variant_defs.*.options.*.media_asset_id' => ['nullable', 'integer'],
            // ADR-021: kombinasi (produk kartesian) dengan harga & stok per kombinasi.
            'combinations' => ['nullable', 'array', 'max:100'],
            'combinations.*.options' => ['required_with:combinations', 'array'],
            'combinations.*.price' => ['required_with:combinations', 'numeric', 'min:0'],
            'combinations.*.stock' => ['nullable', 'string', 'max:50'],
            'initial_price' => ['nullable', 'required_if:create_initial_variant,true', 'numeric', 'min:0'],
            'randomize_stock' => ['sometimes', 'boolean'],
            'initial_stock' => ['nullable', 'required_if:create_initial_variant,true', 'integer', 'min:0'],
        ], [], [
            'name' => 'Nama produk',
        ]);
        $wizard = $request->input('workflow') === 'wizard';
        $createInitialVariant = $request->boolean('create_initial_variant');
        $stockSettings = OperationalSettings::get(OperationalSettings::STOCK_RANDOMIZATION);
        $randomizeStock = $request->has('randomize_stock') ? $request->boolean('randomize_stock') : (bool) $stockSettings['default_enabled'];
        $initialVariant = [
            'price' => $validated['initial_price'] ?? null,
            'stock' => $randomizeStock ? random_int((int) $stockSettings['min'], (int) $stockSettings['max']) : (int) ($validated['initial_stock'] ?? 0),
        ];
        unset(
            $validated['randomize_stock'],
            $validated['create_initial_variant'],
            $validated['initial_price'],
            $validated['initial_stock'],
        );
        // ADR-021: dimensi/berat produk; short_name sepenuhnya otomatis.
        foreach (['weight_kg', 'width_cm', 'height_cm', 'depth_cm'] as $dimensionField) {
            if (array_key_exists($dimensionField, $validated)) {
                $validated[$dimensionField] = $validated[$dimensionField] !== null
                    ? (float) $validated[$dimensionField]
                    : null;
            }
        }
        $validated['short_name'] = \App\Support\CatalogLabels::titleCaseIndonesia(trim((string) $validated['name']))
            ?: $validated['name'];
        $validated['homepage_popular'] = $request->boolean('homepage_popular');
        $validated['homepage_popular_sort'] = (int) ($validated['homepage_popular_sort'] ?? 0);
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        $product = null;
        DB::transaction(function () use ($validated, $createInitialVariant, $initialVariant, $request, &$product): void {
            $product = Product::create([
                ...$validated,
                'status' => 'archived',
                'parent_sku' => ShopeeStyleSku::nextParentSku(),
            ]);

            // Template atribut: isi otomatis dari sub model (tidak menimpa atribut
            // yang sudah ada). Aturan lengkap di docs/decisions/ADR-019.
            app(\App\Services\AttributeTemplateService::class)->applyToProduct($product);

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

            // ADR-021: varian dari definisi (nama varian + opsi) dan kombinasi
            // (harga/stok per kombinasi). Struktur kolom DB tetap variation_1..5.
            $defs = $request->input('variant_defs', []);
            $combinations = $request->input('combinations', []);
            if (is_array($defs) && $defs !== [] && is_array($combinations) && $combinations !== []) {
                $defs = array_values(array_filter($defs, fn ($d) => trim((string) ($d['name'] ?? '')) !== ''));
                // ADR-021: opsi = {value, media_asset_id}; simpan utk attach media varian.
                $optionMedia = [];
                foreach ($defs as $defIndex => $def) {
                    $normalized = [];
                    foreach ((array) ($def['options'] ?? []) as $option) {
                        if (is_array($option)) {
                            $normalized[] = ['value' => (string) ($option['value'] ?? ''), 'media_asset_id' => $option['media_asset_id'] ?? null];
                        } else {
                            $normalized[] = ['value' => (string) $option, 'media_asset_id' => null];
                        }
                    }
                    $defs[$defIndex]['options'] = $normalized;
                }
                foreach ($combinations as $combination) {
                    $options = array_values((array) ($combination['options'] ?? []));
                    if (count($options) !== count($defs)) {
                        continue;
                    }
                    $price = (float) ($combination['price'] ?? 0);
                    if ($price <= 0) {
                        continue;
                    }
                    $row = ['product_id' => $product->id];
                    foreach ($defs as $defIndex => $def) {
                        $slot = $defIndex + 1;
                        $row['variation_'.$slot.'_name'] = $def['name'];
                        $row['variation_'.$slot.'_option'] = $options[$defIndex];
                    }
                    // ADR-021: gambar per opsi -> media varian (is_main utk opsi pertama yg punya gambar).
                    $resolverForVariant = app(\App\Services\MediaAssetResolver::class);
                    $optionMediaAttached = 0;
                    foreach ($defs as $defIndex => $def) {
                        $optionValueKey = mb_strtolower(trim((string) $options[$defIndex]));
                        foreach ($def['options'] as $defOption) {
                            if (mb_strtolower(trim((string) $defOption['value'])) !== $optionValueKey) {
                                continue;
                            }
                            $assetId = $defOption['media_asset_id'] ?? null;
                            if (! $assetId || $optionMediaAttached > 0) {
                                continue;
                            }
                            $asset = \App\Models\MediaAsset::find((int) $assetId);
                            if (! $asset || $asset->status !== 'ready') {
                                continue;
                            }
                            $resolverForVariant->attach($product, $asset, [
                                'product_variant_id' => $variant->id,
                                'position' => 1,
                                'is_main_image' => true,
                                'show_in_catalog' => true,
                                'is_installation' => false,
                                'visibility' => 'visible',
                            ], (int) $request->user()->id);
                            $optionMediaAttached++;
                        }
                    }
                    $stockRaw = trim((string) ($combination['stock'] ?? ''));
                    $row['variant_sku'] = ShopeeStyleSku::nextVariantSku($product);
                    $row['price'] = $price;
                    $row['stock'] = \App\Services\StockCellParser::resolve($stockRaw !== '' ? $stockRaw : null) ?? 0;
                    $row['status'] = 'active';
                    $row['created_by_user_id'] = $request->user()->id;
                    $row['updated_by_user_id'] = $request->user()->id;
                    ProductVariant::create($row);
                }
            }

            // ADR-020: media dipilih/diunggah dari form, lampirkan sekalian.
            $resolver = app(\App\Services\MediaAssetResolver::class);
            foreach ($request->input('media_asset_ids', []) as $index => $assetId) {
                $asset = \App\Models\MediaAsset::find((int) $assetId);
                if (! $asset || $asset->status !== 'ready') {
                    continue;
                }
                $resolver->attach($product, $asset, [
                    'position' => ((int) $index) + 1,
                    'is_main_image' => ((int) $index) === 0,
                    'show_in_catalog' => true,
                    'is_installation' => false,
                    'visibility' => 'visible',
                ], (int) $request->user()->id);
            }
        });

        if ($wizard) {
            // ADR-020: satu halaman penuh; tanpa step variants (media & varian
            // sudah dikirim bersama). Edit page menampilkan checklist publish.
            return redirect()->route('admin.products.edit', ['product' => $product])
                ->with('success', 'Produk draf tersimpan. Lengkapi checklist lalu aktifkan.');
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
                ['label' => 'Sub Model', 'value' => $product->design_variant],
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
        $product->load(['variants', 'attributes', 'media']);

        return Inertia::render('Admin/ProductForm', [
            'backUrl' => route('admin.products.index'),
            'product' => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $product->name,
                'short_name' => $product->short_name,
                'description' => $product->description,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
                'design_variant' => $product->design_variant,
                'status' => $product->status,
                'homepage_popular' => $product->homepage_popular,
                'homepage_popular_sort' => $product->homepage_popular_sort,
                // ADR-020: media katalog dimuat di form utama.
                'media' => $product->media
                    ->where('is_installation', false)
                    ->sortBy('position')
                    ->map(fn ($m) => [
                        'media_asset_id' => $m->media_asset_id,
                        'media_asset_label' => $m->mediaAsset?->label,
                        'url' => $m->mediaAsset?->urlFor('thumb'),
                    ])->values()->all(),
            ],
            'submitUrl' => route('admin.products.update', $product),
            'publishUrl' => route('admin.products.publish', $product),
            'variantBulkUrl' => route('admin.products.variants.bulk', $product),
            'mediaHref' => route('admin.products.media.byProduct', $product),
                'attributesHref' => route('admin.products.attributes.index', $product),
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
            'completion' => app(ProductPublicationService::class)->completion($product),
            'options' => $this->formOptions(),
        ]);
    }

    public function update(Request $request, Product $product, ProductPublicationService $publication): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('products', 'name')->ignore($product->id)],

            'description' => ['nullable', 'string'],
            'product_category' => ['required', Rule::in(array_merge(
                \App\Support\CategoryUrl::productCategoryCodes(),
                ['WINDOW', 'DOOR', 'BOUVEN'], // legacy data lama tetap valid
            ))],
            'product_model' => ['required', Rule::in(\App\Support\CatalogLabels::modelCodes())],
            'design_variant' => ['nullable', 'string', 'max:100', Rule::exists('sub_models', 'code')->where('product_model', $request->input('product_model'))],
            'status' => ['required', 'in:active,archived'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'wizard_step' => ['nullable', 'in:identity,variants,media,review'],
        ], [], [
            'name' => 'Nama produk',
        ]);
        $requestedStatus = $validated['status'];
        $wizardStep = $validated['wizard_step'] ?? null;
        unset($validated['wizard_step']);
        $validated['status'] = 'archived';
        $validated['homepage_popular'] = $request->boolean('homepage_popular');
        $validated['homepage_popular_sort'] = (int) ($validated['homepage_popular_sort'] ?? 0);
        $validated['updated_by_user_id'] = $request->user()->id;
        $product->update($validated);
        if ($requestedStatus === 'active' && $wizardStep === null) {
            $publication->publish($product->fresh(), (int) $request->user()->id);
        }

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
        $product->load(['variants', 'attributes', 'media']);
        $copy = null;

        DB::transaction(function () use ($request, $product, &$copy): void {
            $name = $product->name.' (Salinan)';
            $suffix = 2;
            while (Product::query()->where('name', $name)->exists()) {
                $name = $product->name.' (Salinan '.$suffix.')';
                $suffix++;
            }

            $copy = Product::create([
                'parent_sku' => ShopeeStyleSku::nextParentSku(),
                'name' => $name,
                'short_name' => $product->short_name,
                'description' => $product->description,
                'product_category' => $product->product_category,
                'product_model' => $product->product_model,
                'design_variant' => $product->design_variant,
                'status' => 'archived',
                'homepage_popular' => false,
                'homepage_popular_sort' => 0,
                'created_by_user_id' => $request->user()->id,
                'updated_by_user_id' => $request->user()->id,
            ]);

            $variantMap = [];
            foreach ($product->variants as $variant) {
                $newVariant = ProductVariant::create([
                    'product_id' => $copy->id,
                    'variant_sku' => ShopeeStyleSku::nextVariantSku($copy),
                    'variation_1_name' => $variant->variation_1_name,
                    'variation_1_option' => $variant->variation_1_option,
                    'variation_2_name' => $variant->variation_2_name,
                    'variation_2_option' => $variant->variation_2_option,
                    'price' => $variant->price,
                    'stock' => $variant->stock,
                    'weight_kg' => $variant->weight_kg,
                    'width_cm' => $variant->width_cm,
                    'height_cm' => $variant->height_cm,
                    'depth_cm' => $variant->depth_cm,
                    'status' => $variant->status,
                    'created_by_user_id' => $request->user()->id,
                    'updated_by_user_id' => $request->user()->id,
                ]);
                $variantMap[$variant->id] = $newVariant->id;
            }

            foreach ($product->attributes as $attribute) {
                ProductAttribute::create([
                    'product_id' => $copy->id,
                    'product_variant_id' => $variantMap[$attribute->product_variant_id] ?? null,
                    'attribute_name' => $attribute->attribute_name,
                    'attribute_value' => $attribute->attribute_value,
                    'source' => $attribute->source,
                    'created_by_user_id' => $request->user()->id,
                    'updated_by_user_id' => $request->user()->id,
                ]);
            }

            foreach ($product->media as $media) {
                $mediaCopy = $media->replicate();
                $mediaCopy->product_id = $copy->id;
                $mediaCopy->product_variant_id = $variantMap[$media->product_variant_id] ?? null;
                $mediaCopy->created_by_user_id = $request->user()->id;
                $mediaCopy->updated_by_user_id = $request->user()->id;
                $mediaCopy->save();
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

        return redirect()->route('admin.products.edit', ['product' => $product, 'step' => 'review'])
            ->with('success', 'Produk dipublikasikan.');
    }

    public function archive(Product $product): RedirectResponse
    {
        $product->update(['status' => 'archived']);

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk diarsipkan.');
    }

    public function unarchive(Request $request, Product $product, ProductPublicationService $publication): RedirectResponse
    {
        $publication->publish($product, (int) $request->user()->id);

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
            'sold_count' => (int) ($product->sold_count ?? 0),
            'image' => $product->mainImage?->urlFor('card'),
            'updated_at' => optional($product->updated_at)?->toIso8601String(),
            'href' => route('admin.products.edit', $product),
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
            'categories' => array_merge(
                [['value' => 'all', 'label' => 'Semua kategori']],
                \App\Models\Category::query()->orderBy('sort_order')->orderBy('id')->get()
                    ->map(fn (\App\Models\Category $c) => ['value' => $c->code, 'label' => $c->name])->all(),
            ),
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
     * Parser pencarian ukuran admin: tinggi×panjang exact, misalnya 100x50, tidak pernah membalik orientasi.
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
            'categories' => \App\Models\Category::query()->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (\App\Models\Category $c) => ['value' => $c->code, 'label' => $c->name])->all(),
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
