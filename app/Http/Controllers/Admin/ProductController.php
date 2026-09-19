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
    /**
     * Urutan daftar produk: satu sumber kebenaran untuk label UI, query layar,
     * dan file export. Kunci updated_* dipakai untuk baru saja diubah supaya
     * hasil import dan hasil edit sama-sama terangkat, bukan hanya produk baru.
     */
    private const SORT_OPTIONS = [
        'updated_desc' => ['label' => 'Baru saja diubah', 'column' => 'updated_at', 'direction' => 'desc'],
        'updated_asc' => ['label' => 'Paling lama tidak diubah', 'column' => 'updated_at', 'direction' => 'asc'],
        'sold_desc' => ['label' => 'Terlaris', 'column' => 'sold_count', 'direction' => 'desc'],
        'sold_asc' => ['label' => 'Paling sedikit terjual', 'column' => 'sold_count', 'direction' => 'asc'],
        'created_desc' => ['label' => 'Terbaru ditambahkan', 'column' => 'created_at', 'direction' => 'desc'],
        'created_asc' => ['label' => 'Terlama ditambahkan', 'column' => 'created_at', 'direction' => 'asc'],
    ];

    private const DEFAULT_SORT = 'updated_desc';

    public function index(Request $request): Response
    {
        $view = 'list';
        $category = (string) $request->input('product_category', 'all');
        $model = (string) $request->input('product_model', 'all');
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));
        $size = $q !== '' ? $this->parseSizeQuery($q) : null;
        $sort = $this->resolveListSort($request->input('sort'));


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
            );

        $this->applyListSort($products, $sort);

        $products = $products->paginate(14)->withQueryString();

        return Inertia::render('Admin/Products/Index', [
            'title' => 'Daftar Produk',
            'description' => 'Kelola katalog produk, status, serta Import & Media dari menu Produk.',
            'searchQuery' => $q,
            'activeSort' => $sort,
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
        $sort = $this->resolveListSort($request->input('sort'));

        $query = Product::query()
            ->withCount('variants as variants_count')
            ->withSum('validOrderItems as sold_count', 'quantity')
            ->withSum('activeVariants as stock_total', 'stock')
            ->withMin('variants as min_price', 'price')
            ->withMax('variants as max_price', 'price')
            ->withCount(['media as media_count' => fn ($b) => $b->where('show_in_catalog', true)])
            ->withCount(['media as installation_media_count' => fn ($b) => $b->where('is_installation', true)])
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
            ->when($status !== '' && $status !== 'all', fn ($builder) => $builder->where('status', $status));

        $this->applyListSort($query, $sort);

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

    public function store(Request $request, ProductPublicationService $publication): RedirectResponse
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
            // Sub model OPSIONAL dan TIDAK diikat daftar sub_models: kode baru
            // (mis. ZIGZAG + ORNAMEN) boleh dipakai walau belum terdaftar sebagai
            // sub model, dan kosong berarti produk berdiri sendiri tanpa sub model
            // (kontrak owner 2026-09-18, contoh: Boven Zigzag).
            'design_variant' => ['nullable', 'string', 'max:100'],
            'status' => ['required', 'in:active,archived'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'create_initial_variant' => ['sometimes', 'boolean'],
            // ADR-020: media dipilih/diunggah langsung di form, dilampirkan setelah produk dibuat.
            'media_asset_ids' => ['nullable', 'array', 'max:20'],
            'media_asset_ids.*' => ['integer', Rule::exists('media_assets', 'id')->where('status', 'ready')],
            // Hasil pemasangan dari form create: ditempel sebagai media is_installation.
            'installation_media_asset_ids' => ['nullable', 'array', 'max:20'],
            'installation_media_asset_ids.*' => ['integer', Rule::exists('media_assets', 'id')->where('status', 'ready')],
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
        // Produk baru masuk ke urutan paling belakang daftar Paling Banyak Dipesan
        // supaya tidak menyalip produk yang sudah dikurasi admin.
        $validated['homepage_popular_sort'] = (int) ($validated['homepage_popular_sort']
            ?? ((int) Product::query()->max('homepage_popular_sort') + 1));
        // Kode desain disimpan KAPITAL agar cocok dengan filter katalog
        // (CatalogLabels::normalizeDesign dipakai di sisi storefront).
        $validated['design_variant'] = \App\Support\CatalogLabels::normalizeDesign($validated['design_variant'] ?? null);
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        $product = null;
        DB::transaction(function () use ($validated, $createInitialVariant, $initialVariant, $request, $publication, &$product): void {
            $product = Product::create([
                ...$validated,
                // Produk dibuat sebagai arsip sementara selama seluruh data
                // disusun; bila tombol Aktifkan dipilih, publication gate dijalankan
                // dalam transaksi yang sama setelah varian dan media terpasang.
                'status' => 'archived',
                'parent_sku' => ShopeeStyleSku::nextParentSku(),
            ]);

            // Template spesifikasi: isi otomatis dari sub model (tidak menimpa spesifikasi
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
                    $row = [
                        'product_id' => $product->id,
                        'height_cm' => $product->height_cm,
                        'width_cm' => $product->width_cm,
                        'depth_cm' => $product->depth_cm,
                        'weight_kg' => $product->weight_kg,
                    ];
                    foreach ($defs as $defIndex => $def) {
                        $slot = $defIndex + 1;
                        $row['variation_'.$slot.'_name'] = $def['name'];
                        $row['variation_'.$slot.'_option'] = $options[$defIndex];
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

                // ADR-021: simpan foto per opsi varian ke varian perwakilan (posisi 50+),
                // satu attachment per opsi agar tidak terduplikasi ke setiap kombinasi.
                $resolverForVariant = app(\App\Services\MediaAssetResolver::class);
                foreach ($defs as $defIndex => $def) {
                    $slotNo = $defIndex + 1;
                    if ($slotNo > 5) break;
                    foreach ($def['options'] ?? [] as $opt) {
                        $optVal = trim((string) ($opt['value'] ?? ''));
                        $assetId = ! empty($opt['media_asset_id']) ? (int) $opt['media_asset_id'] : null;
                        if ($optVal === '' || ! $assetId) {
                            continue;
                        }
                        $asset = \App\Models\MediaAsset::find($assetId);
                        if (! $asset || $asset->status !== 'ready') {
                            continue;
                        }
                        $repVariant = $product->variants()
                            ->where('variation_'.$slotNo.'_option', $optVal)
                            ->orderBy('id')
                            ->first();
                        if ($repVariant) {
                            $resolverForVariant->attach($product, $asset, [
                                'product_variant_id' => $repVariant->id,
                                'position' => 50 + ($slotNo - 1) * 10,
                                'is_main_image' => false,
                                'show_in_catalog' => true,
                                'is_installation' => false,
                                'visibility' => 'visible',
                            ], (int) $request->user()->id);
                        }
                    }
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

            // Hasil pemasangan dari form create: lampirkan dengan flag
            // is_installation (urutan mengikuti urutan array dari form).
            foreach ($request->input('installation_media_asset_ids', []) as $index => $assetId) {
                $asset = \App\Models\MediaAsset::find((int) $assetId);
                if (! $asset || $asset->status !== 'ready') {
                    continue;
                }
                $resolver->attach($product, $asset, [
                    'position' => ((int) $index) + 1,
                    'is_main_image' => false,
                    'show_in_catalog' => false,
                    'is_installation' => true,
                    'visibility' => 'visible',
                ], (int) $request->user()->id);
            }

            // Tombol "Simpan & aktifkan" pada halaman create langsung menjalankan
            // gate publikasi. Karena masih di dalam transaksi, produk tidak akan
            // tersimpan setengah aktif bila checklist belum lengkap.
            if (($validated['status'] ?? 'archived') === 'active') {
                $publication->publish($product->fresh(), (int) $request->user()->id);
            }
        });

        // Simpan sukses = keluar dari form, kembali ke daftar produk
        // (kontrak global: halaman edit/create tidak menahan admin).
        return redirect()->route('admin.products.index')
            ->with('success', $product->status === 'active'
                ? 'Produk berhasil dibuat dan diaktifkan.'
                : 'Produk draf tersimpan dengan SKU '.$product->parent_sku.'. Lengkapi checklist lalu aktifkan.');
    }

    /**
     * Format dimensi tanpa desimal bermakna: 1.000 -> "1", 100.00 -> "100".
     * Desimal asli ditulis dgn koma (konvensi Indonesia): 30.5 -> "30,5".
     */
    public static function cleanDimension($value): string
    {
        $s = number_format((float) $value, 3, '.', '');
        $s = rtrim($s, '0');
        $s = rtrim($s, '.');
        return str_replace('.', ',', $s);
    }

    /**
     * Detail produk - table-first: header ringkas, tabel metadata, lalu tab
     * (Ringkasan | Varian | Spesifikasi | Media). Hanya isi tab aktif yang
     * dirender, dan tab aktif tercermin di URL lewat ?tab= agar reload serta
     * tombol back/forward browser tetap konsisten.
     */
    public function show(Request $request, Product $product): Response
    {
        $product->load(['variants', 'attributes', 'media.mediaAsset', 'media.productVariant', 'mainImage']);

        // Storefront hanya melayani produk aktif yang punya varian aktif, jadi
        // tombol "Lihat publik" tidak boleh dirender untuk produk arsip
        // (sebelumnya menghasilkan 404 saat diklik).
        $publicVisible = $product->status === 'active' && $product->variants->contains(fn ($v) => $v->status === 'active');

        // Tab Ringkasan ditiadakan (deskripsi bergabung ke tab Spesifikasi).
        // Default tab aktif adalah Varian.
        $requestedTab = (string) $request->query('tab', 'varian');
        $activeTab = in_array($requestedTab, ['varian', 'spesifikasi', 'media'], true)
            ? $requestedTab
            : 'varian';

        $formatDimension = fn ($value) => $value === null || (float) $value <= 0
            ? null
            : self::cleanDimension($value);

        // Detail produk dipisah dari identitas: nama, Parent SKU, dan status
        // tampil di kartu identitas; sisanya jadi daftar detail di kartu sebelah.
        // Berat dan dimensi dipecah dari satu string gabungan jadi dua baris
        // supaya tiap baris tetap ringkas.
        $dimensiParts = array_filter([
            $formatDimension($product->height_cm) !== null ? 'T '.$formatDimension($product->height_cm) : null,
            $formatDimension($product->width_cm) !== null ? 'P '.$formatDimension($product->width_cm) : null,
            $formatDimension($product->depth_cm) !== null ? 'L '.$formatDimension($product->depth_cm) : null,
        ]);
        $berat = $formatDimension($product->weight_kg);

        $details = array_values(array_filter([
            ['label' => 'Kategori', 'value' => CatalogLabels::category($product->product_category)],
            ['label' => 'Model', 'value' => CatalogLabels::model($product->product_model)],
            ['label' => 'Sub Model', 'value' => CatalogLabels::design($product->design_variant) ?: null],
            ['label' => 'Berat paket', 'format' => 'text', 'value' => $berat !== null ? $berat.' kg' : null],
            [
                'label' => 'Dimensi paket',
                'format' => 'text',
                'value' => $dimensiParts !== [] ? implode(' × ', $dimensiParts).' cm' : null,
            ],
            ['label' => 'Pengiriman', 'value' => 'J&T Cargo'],
        ]));

        $variants = $product->variants
            ->sortBy('variant_sku')
            ->values()
            ->map(function ($v) {
                $label = trim(implode(' · ', array_filter([
                    $v->variation_1_option,
                    $v->variation_2_option,
                ])));

                return [
                    'id' => $v->id,
                    'label' => $label !== '' ? $label : $v->variant_sku,
                    'status' => $v->status,
                    'price' => (float) $v->price,
                    'stock' => (int) $v->stock,
                    'sku' => $v->variant_sku,
                    'edit_url' => route('admin.variants.edit', $v),
                ];
            })
            ->all();

        $attributes = $product->attributes
            ->sortBy('attribute_name')
            ->values()
            ->map(fn ($a) => [
                'id' => $a->id,
                'name' => $a->attribute_name,
                'value' => (string) $a->attribute_value,
                'updated_at' => $a->updated_at?->translatedFormat('d M Y'),
            ])
            ->all();

        $media = $product->media
            ->filter(fn ($m) => ! $m->is_installation)
            ->sortBy([['position', 'asc'], ['id', 'asc']])
            ->values()
            ->map(function ($m) {
                // Foto opsi varian (posisi 50+) diberi label varian pemiliknya;
                // posisi mentah tidak informatif karena banyak baris berbagi band.
                $owner = $m->productVariant
                    ? trim(implode(' / ', array_filter([
                        $m->productVariant->variation_1_option,
                        $m->productVariant->variation_2_option,
                    ])))
                    : null;

                $nama = $owner !== '' && $owner !== null
                    ? 'Foto varian: '.$owner
                    : ($m->is_main_image ? 'Foto utama katalog' : 'Foto katalog');

                $sumber = $m->mediaAsset?->label
                    ?: ($m->source_url ? basename((string) parse_url($m->source_url, PHP_URL_PATH)) : null);

                $previewUrl = $m->mediaAsset?->publicUrlForPath((string) $m->mediaAsset->object_key)
                    ?? $m->urlFor('pdp')
                    ?? $m->urlFor('thumb')
                    ?? $m->stored_url;

                $libraryUrl = $m->media_asset_id
                    ? route('admin.media.library', ['q' => $m->mediaAsset?->label ?: ($sumber ?: '')])
                    : ($sumber ? route('admin.media.library', ['q' => $sumber]) : route('admin.media.library'));

                return [
                    'id' => $m->id,
                    'media_asset_id' => $m->media_asset_id,
                    'name' => $nama,
                    'kind' => $m->mediaAsset?->kind === 'video' ? 'video' : 'foto',
                    'status' => $m->status,
                    'visibility' => $m->visibility,
                    'file' => $sumber,
                    'updated_at' => $m->updated_at?->translatedFormat('d M Y'),
                    'thumb_url' => $m->mediaAsset?->urlFor('thumb') ?? $m->urlFor('thumb') ?? $m->stored_url,
                    'preview_url' => $previewUrl,
                    'library_url' => $libraryUrl,
                ];
            })
            ->all();

        return Inertia::render('Admin/Products/Show', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'parent_sku' => $product->parent_sku,
                'status' => $product->status,
                'description' => $product->description,
                'public_visible' => $publicVisible,
                // Foto utama katalog untuk kartu identitas; relasi mainImage
                // sudah menghormati visibility, show_in_catalog, dan posisi.
                'image_url' => $product->mainImage?->urlFor('card')
                    ?? $product->mainImage?->urlFor('thumb'),
                'edit_href' => route('admin.products.edit', $product),
                'product_href' => route('product.show', $product->parent_sku, absolute: false),
            ],
            'details' => $details,
            'activeTab' => $activeTab,
            'counts' => [
                'varian' => count($variants),
                'spesifikasi' => count($attributes),
                'media' => count($media),
            ],
            'variants' => $variants,
            'attributes' => $attributes,
            'media' => $media,
            'links' => [
                'variants' => route('admin.products.edit', ['product' => $product, 'tab' => 'varian']),
                'attributes' => route('admin.products.attributes.index', $product),
                // Tombol kelola media mengarah ke Media Library pusat
                'media' => route('admin.media.library'),
                'import' => route('admin.imports.index'),
            ],
        ]);
    }

    public function edit(Request $request, Product $product): Response
    {
        $product->load(['variants' => fn ($q) => $q->withCount([
            'media as media_count' => fn ($mq) => $mq->where('visibility', '!=', 'archived'),
        ]), 'attributes', 'media.mediaAsset', 'media.productVariant', 'media.product:id,parent_sku']);

        $requestedTab = (string) $request->query('tab', 'identitas');
        $activeTab = in_array($requestedTab, ['identitas', 'varian', 'media'], true)
            ? $requestedTab
            : 'identitas';

        // ADR-021: rekonstruksi definisi varian utk form (nama+opsi unik urut slot,
        // plus gambar per opsi dari media varian).
        $variantDefs = [];
        $activeVariants = $product->variants->filter(fn ($v) => $v->status === 'active')->values();
        $slotCount = 0;
        foreach ($activeVariants as $v) {
            for ($s = 1; $s <= 5; $s++) {
                if (trim((string) $v->{'variation_'.$s.'_option'}) !== '') {
                    $slotCount = max($slotCount, $s);
                }
            }
        }
        // Gambar per opsi: media product-level posisi 10..49 ditaut berurutan
        // ke opsi (urutan sama dengan importer: per slot varian, opsi urut).
        // Media varian-level (form manual lama) tetap diutamakan.
        $perOptionMedia = $product->media
            ->filter(fn ($m) => $m->product_variant_id === null
                && ! $m->is_main_image
                && ! $m->is_installation
                && $m->position >= 50 && $m->position < 80)
            ->sortBy('position')
            ->values();
        $optMediaIdx = 0;

        for ($s = 1; $s <= $slotCount; $s++) {
            $name = '';
            $options = [];
            $seen = [];
            foreach ($activeVariants as $v) {
                $option = trim((string) $v->{'variation_'.$s.'_option'});
                if ($option === '') {
                    continue;
                }
                $name = (string) $v->{'variation_'.$s.'_name'};
                $key = mb_strtolower($option);
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $media = $product->media->first(fn ($m) => $m->product_variant_id === $v->id);
                if (! $media && $optMediaIdx < $perOptionMedia->count()) {
                    $media = $perOptionMedia[$optMediaIdx];
                }
                if ($media) {
                    $optMediaIdx++;
                }
                $options[] = [
                    'value' => $option,
                    'media_asset_id' => ($media && $media->mediaAsset) ? $media->mediaAsset->id : null,
                    'thumb_url' => ($media && $media->mediaAsset) ? $media->mediaAsset->urlFor('thumb') : null,
                ];
            }
            if ($options !== []) {
                $variantDefs[] = ['name' => $name, 'options' => $options];
            }
        }

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
                // Tampilkan tanpa desimal bermakna (1.000 -> 1, 100.00 -> 100).
                'weight_kg' => $product->weight_kg !== null ? self::cleanDimension($product->weight_kg) : '',
                'height_cm' => $product->height_cm !== null ? self::cleanDimension($product->height_cm) : '',
                'width_cm' => $product->width_cm !== null ? self::cleanDimension($product->width_cm) : '',
                'depth_cm' => $product->depth_cm !== null ? self::cleanDimension($product->depth_cm) : '',                // Galeri form: SEMUA media katalog milik produk (utama, foto
                // yang dipakai juga sebagai hasil pemasangan, shared image).
                // is_installation berarti "dipakai juga sebagai hasil pasang",
                // bukan "bukan foto katalog". Video tetap dikelola di halaman
                // Media; media per-varian (posisi 50+) ada di formulir varian.
                'media' => $product->media
                    ->filter(fn ($m) => $m->show_in_catalog && ! $m->is_installation)
                    // Urut sesuai position form: foto non-varian seperti shared media
                    // bebas diletakkan di belakang varian di etalase toko.
                    ->sortBy(fn ($m) => sprintf(
                        '%06d-%06d',
                        (int) $m->position,
                        (int) $m->id,
                    ))
                    ->map(fn ($m) => [
                        'media_asset_id' => $m->media_asset_id,
                        'media_asset_label' => $m->mediaAsset?->label,
                        'kind' => $m->mediaAsset?->kind ?? 'image',
                        'url' => $m->mediaAsset?->urlFor('thumb'),
                        // Video: file sumber untuk pratinjau PDP.
                        'video_url' => $m->mediaAsset?->kind === 'video'
                            ? $m->mediaAsset?->urlFor('video')
                            : null,
                        // Pemilik media: null = katalog (semua varian).
                        'product_variant_id' => $m->product_variant_id,
                        'variant_label' => $m->productVariant
                            ? trim(implode(' / ', array_filter([
                                $m->productVariant->variation_1_option,
                                $m->productVariant->variation_2_option,
                            ]))) ?: $m->productVariant->variant_sku
                            : null,
                    ])->values()->all(),
            ],
            'submitUrl' => route('admin.products.update', $product),
            'publishUrl' => route('admin.products.publish', $product),
            'variantBulkUrl' => route('admin.products.variants.bulk', $product),
            'mediaHref' => route('admin.products.edit', ['product' => $product, 'tab' => 'media']),
                'attributesHref' => route('admin.products.attributes.index', $product),
            'wizardStep' => in_array($requestStep = request()->query('step'), ['identity', 'variants', 'media', 'review'], true)
                ? $requestStep
                : 'identity',
            'variant_defs' => $variantDefs,
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
            // Daftar media hasil pemasangan (is_installation) milik produk ini.
            // Sebelumnya prop ini tidak pernah dikirim, sehingga section
            // "Hasil Pemasangan" selalu 0 dan media yang baru dipilih lewat
            // MediaPicker tidak muncul (meski tersimpan di database).
            'installationMedia' => $product->installationMedia()
                ->visible()
                ->with('mediaAsset')
                ->orderBy('position')
                ->orderBy('id')
                ->get()
                ->map(fn ($m) => [
                    'id' => $m->id,
                    'media_asset_id' => $m->media_asset_id,
                    'label' => $m->mediaAsset?->label,
                    'url' => $m->mediaAsset?->urlFor('thumb') ?? $m->mediaAsset?->urlFor('card'),
                    'kind' => $m->mediaAsset?->kind ?? 'image',
                    'position' => (int) $m->position,
                    'show_in_catalog' => (bool) $m->show_in_catalog,
                    'installation_caption' => $m->installation_caption,
                    'update_url' => route('admin.media.update', ['media' => $m->id]),
                    'archive_url' => route('admin.media.archive', ['media' => $m->id]),
                ])
                ->values()
                ->all(),
            // Key harus sejajar dengan kontrak MediaPanelUrls di
            // resources/js/components/admin/product-edit/types.ts.
            // Sebelumnya dikirim tanpa akhiran "Url" sehingga frontend membaca
            // mediaActionUrls.storeUrl = undefined -> router.post(undefined) crash
            // dan tombol "Gunakan media" tidak berfungsi.
            'mediaActionUrls' => [
                'storeUrl' => route('admin.products.media.store', $product),
                'bulkUrl' => route('admin.products.media.bulk', $product),
                'presignUrl' => route('admin.media.presign'),
                'finalizeUrl' => route('admin.media.finalize'),
                'statusUrl' => route('admin.media.status'),
                'pickerUrl' => route('admin.media.picker'),
                'uploadUrl' => route('admin.media.upload'),
            ],
            'productLibrary' => \App\Models\MediaAsset::query()
                ->withCount(['attachments as usage_count' => fn ($query) => $query->where('visibility', '!=', 'archived')])
                ->where('visibility', '!=', 'archived')
                ->where('status', 'ready')
                ->latest()
                ->limit(30)
                ->get()
                ->map(fn ($asset) => [
                    'id' => $asset->id,
                    'label' => $asset->label ?: 'Media #'.$asset->id,
                    'kind' => $asset->kind,
                    'status' => $asset->status,
                    'usage_count' => (int) $asset->usage_count,
                    'thumb_url' => $asset->urlFor('thumb'),
                    'media_url' => $asset->urlFor($asset->kind === 'video' ? 'video' : 'thumb'),
                ])->values()->all(),
            'library' => \App\Models\MediaAsset::query()
                ->withCount(['attachments as usage_count' => fn ($query) => $query->where('visibility', '!=', 'archived')])
                ->where('visibility', '!=', 'archived')
                ->latest()
                ->limit(30)
                ->get()
                ->map(fn ($asset) => [
                    'id' => $asset->id,
                    'label' => $asset->label ?: 'Media #'.$asset->id,
                    'kind' => $asset->kind,
                    'status' => $asset->status,
                    'usage_count' => (int) $asset->usage_count,
                    'thumb_url' => $asset->urlFor('thumb'),
                    'media_url' => $asset->urlFor($asset->kind === 'video' ? 'video' : 'thumb'),
                ])->values()->all(),
        ]);
    }

    public function update(Request $request, Product $product, ProductPublicationService $publication): RedirectResponse
    {
        // Dimensi boleh diketik dgn koma desimal (30,5); normalisasi ke titik
        // sebelum validasi numeric.
        $request->merge([
            'weight_kg' => str_replace(',', '.', (string) $request->input('weight_kg', '')),
            'height_cm' => str_replace(',', '.', (string) $request->input('height_cm', '')),
            'width_cm' => str_replace(',', '.', (string) $request->input('width_cm', '')),
            'depth_cm' => str_replace(',', '.', (string) $request->input('depth_cm', '')),
        ]);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('products', 'name')->ignore($product->id)],

            'description' => ['nullable', 'string'],
            'product_category' => ['required', Rule::in(array_merge(
                \App\Support\CategoryUrl::productCategoryCodes(),
                ['WINDOW', 'DOOR', 'BOUVEN'], // legacy data lama tetap valid
            ))],
            'product_model' => ['required', Rule::in(\App\Support\CatalogLabels::modelCodes())],
            // Sub model OPSIONAL dan TIDAK diikat daftar sub_models: kode baru
            // (mis. ZIGZAG + ORNAMEN) boleh dipakai walau belum terdaftar sebagai
            // sub model, dan kosong berarti produk berdiri sendiri tanpa sub model
            // (kontrak owner 2026-09-18, contoh: Boven Zigzag).
            'design_variant' => ['nullable', 'string', 'max:100'],
            'status' => ['required', 'in:active,archived'],
            // Berat dan dimensi adalah data produk yang wajib ikut disimpan
            // saat form edit atau aktivasi dikirim.
            'weight_kg' => ['nullable', 'numeric', 'min:0'],
            'width_cm' => ['nullable', 'numeric', 'min:0'],
            'height_cm' => ['nullable', 'numeric', 'min:0'],
            'depth_cm' => ['nullable', 'numeric', 'min:0'],
            'homepage_popular' => ['sometimes', 'boolean'],
            'homepage_popular_sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'wizard_step' => ['nullable', 'in:identity,variants,media,review'],
            // ADR-020/021: edit form satu halaman mengirim media & varian juga.
            'media_asset_ids' => ['nullable', 'array', 'max:20'],
            'media_asset_ids.*' => ['integer'],
            'variant_defs' => ['nullable', 'array', 'max:5'],
            'variant_defs.*.name' => ['required_with:variant_defs', 'string', 'max:100'],
            'variant_defs.*.options' => ['required_with:variant_defs', 'array', 'min:1', 'max:50'],
            'variant_defs.*.options.*.value' => ['required_with:variant_defs', 'string', 'max:255'],
            'variant_defs.*.options.*.media_asset_id' => ['nullable', 'integer'],
            'combinations' => ['nullable', 'array', 'max:100'],
            'combinations.*.options' => ['required_with:combinations', 'array'],
            'combinations.*.price' => ['required_with:combinations', 'numeric', 'min:0'],
            'combinations.*.stock' => ['nullable', 'string', 'max:50'],
        ], [], [
            'name' => 'Nama produk',
        ]);
        foreach (['weight_kg', 'width_cm', 'height_cm', 'depth_cm'] as $dimensionField) {
            if (array_key_exists($dimensionField, $validated)) {
                $validated[$dimensionField] = $validated[$dimensionField] !== null && $validated[$dimensionField] !== ''
                    ? (float) $validated[$dimensionField]
                    : null;
            }
        }
        $requestedStatus = $validated['status'];
        $wizardStep = $validated['wizard_step'] ?? null;
        unset($validated['wizard_step']);
        // Status mengikuti tombol yang ditekan (Simpan mempertahankan status
        // sekarang); tidak dipaksa archived.
        // Flag kurasi "Paling Banyak Dipesan" hanya ditulis bila form benar-benar
        // mengirimnya; form produk tidak punya input ini, dan boolean() atas field
        // yang absen selalu false sehingga kurasi admin ter-reset tiap Simpan.
        if ($request->has('homepage_popular')) {
            $validated['homepage_popular'] = $request->boolean('homepage_popular');
        }
        if ($request->has('homepage_popular_sort')) {
            $validated['homepage_popular_sort'] = (int) $validated['homepage_popular_sort'];
        }
        $validated['updated_by_user_id'] = $request->user()->id;
        $validated['design_variant'] = \App\Support\CatalogLabels::normalizeDesign($validated['design_variant'] ?? null);
        $product->update($validated);

        // ADR-020: sinkronkan media katalog dari urutan form.
        if ($request->filled('media_asset_ids')) {
            $resolver = app(\App\Services\MediaAssetResolver::class);
            $sentIds = collect($request->input('media_asset_ids', []))->map(fn ($v) => (int) $v)->all();

            // Foto utama = media KATALOG (bukan varian) paling awal di urutan
            // form. Menentukan ini lebih dulu (bukan dari $index) supaya media
            // varian di urutan awal tidak pernah jadi cover storefront.
            $catalogRow = $product->media()->whereNull('product_variant_id')->get(['media_asset_id'])
                ->pluck('media_asset_id')->all();
            $mainAssetId = null;
            foreach ($sentIds as $assetId) {
                if (in_array($assetId, $catalogRow, true)) {
                    $mainAssetId = $assetId;
                    break;
                }
            }

            $position = 1;
            foreach ($sentIds as $assetId) {
                $asset = \App\Models\MediaAsset::find($assetId);
                if (! $asset || $asset->status !== 'ready') continue;
                $mediaRows = $product->media
                    ->where('is_installation', false)
                    ->where('media_asset_id', $assetId);

                if ($mediaRows->isNotEmpty()) {
                    foreach ($mediaRows as $media) {
                        $isVariantRow = $media->product_variant_id !== null;
                        $media->update([
                            'position' => $position,
                            'is_main_image' => ! $isVariantRow && $assetId === $mainAssetId,
                            'show_in_catalog' => true,
                            'visibility' => 'visible',
                        ]);
                    }
                } else {
                    $resolver->attach($product, $asset, [
                        'position' => $position,
                        'is_main_image' => $assetId === $mainAssetId,
                        'show_in_catalog' => true,
                        'is_installation' => false,
                        'visibility' => 'visible',
                    ], (int) $request->user()->id);
                }
                $position++;
            }

            // Media katalog (is_installation = false) yang tidak dikirim lagi -> arsipkan.
            $product->media()
                ->where('is_installation', false)
                ->whereNotIn('media_asset_id', $sentIds)
                ->update(['show_in_catalog' => false, 'visibility' => 'archived']);

            // Penegakan gambar utama
            $main = null;
            if ($mainAssetId !== null) {
                $main = \App\Models\ProductMedia::where('product_id', $product->id)
                    ->where('is_installation', false)
                    ->whereNull('product_variant_id')
                    ->where('media_asset_id', $mainAssetId)
                    ->where('show_in_catalog', true)
                    ->where('visibility', 'visible')
                    ->orderBy('position')
                    ->orderBy('id')
                    ->first();
            }
            if ($main === null) {
                $main = \App\Models\ProductMedia::where('product_id', $product->id)
                    ->where('is_installation', false)
                    ->whereNull('product_variant_id')
                    ->where('show_in_catalog', true)
                    ->where('visibility', 'visible')
                    ->orderBy('position')
                    ->orderBy('id')
                    ->first();
            }
            \App\Models\ProductMedia::where('product_id', $product->id)
                ->where('is_installation', false)
                ->update(['is_main_image' => false]);
            if ($main) {
                \App\Models\ProductMedia::where('id', $main->id)
                    ->update(['is_main_image' => true]);
            }
        }

        // ADR-021: definisi varian & kombinasi (harga/stok) dari form edit.
        $slotNames = [];
        if ($request->filled('variant_defs')) {
            $resolverForOption = app(\App\Services\MediaAssetResolver::class);
            foreach ($request->input('variant_defs', []) as $slot => $def) {
                $slotName = trim((string) ($def['name'] ?? ''));
                if ($slotName === '') continue;
                $slotNo = $slot + 1;
                if ($slotNo > 5) break;
                $slotNames[$slotNo] = $slotName;

                // Nama varian slot ini diperbarui di semua varian yang punya opsi pada slot tersebut.
                $product->variants()
                    ->where('variation_'.$slotNo.'_option', '!=', '')
                    ->update(['variation_'.$slotNo.'_name' => $slotName]);

                // Simpan foto per opsi varian ke varian perwakilan (posisi 50+)
                foreach ($def['options'] ?? [] as $opt) {
                    $optVal = trim((string) ($opt['value'] ?? ''));
                    $assetId = ! empty($opt['media_asset_id']) ? (int) $opt['media_asset_id'] : null;
                    if ($optVal === '' || ! $assetId) {
                        continue;
                    }
                    $asset = \App\Models\MediaAsset::find($assetId);
                    if (! $asset || $asset->status !== 'ready') {
                        continue;
                    }
                    $repVariant = $product->variants()
                        ->where('variation_'.$slotNo.'_option', $optVal)
                        ->orderBy('id')
                        ->first();
                    if ($repVariant) {
                        // Baris yang SUDAH ada tidak boleh dipaksa kembali ke
                        // posisi band (50, 60, 70...): itu menimpa urutan foto
                        // yang baru saja diatur admin di form, sehingga urutan
                        // tampak "tidak tersimpan". Posisi band hanya dipakai
                        // saat baris varian ini baru dibuat.
                        $existingVariantRow = \App\Models\ProductMedia::query()
                            ->where('product_id', $product->id)
                            ->where('media_asset_id', $asset->id)
                            ->where('product_variant_id', $repVariant->id)
                            ->exists();

                        $variantAttrs = [
                            'product_variant_id' => $repVariant->id,
                            'is_main_image' => false,
                            'show_in_catalog' => true,
                            'is_installation' => false,
                            'visibility' => 'visible',
                        ];
                        if (! $existingVariantRow) {
                            $variantAttrs['position'] = 50 + ($slotNo - 1) * 10;
                        }

                        $resolverForOption->attach($product, $asset, $variantAttrs, (int) $request->user()->id);
                    }
                }
            }
        }

        // Penegakan URUTAN FINAL dari form: posisi murni 1..N sesuai susunan form
        if ($request->filled('media_asset_ids')) {
            $orderedAssetIds = collect($request->input('media_asset_ids', []))
                ->map(fn ($v) => (int) $v)
                ->all();

            $position = 1;
            foreach ($orderedAssetIds as $orderedAssetId) {
                $rows = \App\Models\ProductMedia::query()
                    ->where('product_id', $product->id)
                    ->where('media_asset_id', $orderedAssetId)
                    ->where('is_installation', false)
                    ->where('show_in_catalog', true)
                    ->where('visibility', 'visible')
                    ->get();

                foreach ($rows as $row) {
                    if ((int) $row->position !== $position) {
                        $row->update(['position' => $position]);
                    }
                }
                $position++;
            }
        }

        if ($request->filled('combinations')) {
            $matchedVariantIds = [];
            foreach ($request->input('combinations', []) as $combo) {
                $options = array_values(array_map('trim', (array) ($combo['options'] ?? [])));
                if ($options === []) {
                    continue;
                }

                // Pencocokan varian berbasis NAMA OPSI (anti-swap dan tahan reorder)
                $q = $product->variants();
                for ($s = 1; $s <= count($options); $s++) {
                    $q->where('variation_'.$s.'_option', $options[$s - 1]);
                }
                $variant = $q->first();

                // Hitung stok
                $stockRaw = trim((string) ($combo['stock'] ?? ''));
                $resolvedStock = $stockRaw !== ''
                    ? \App\Services\StockCellParser::resolve($stockRaw)
                    : null;

                if ($variant) {
                    $variant->price = (float) ($combo['price'] ?? $variant->price);
                    if ($resolvedStock !== null) {
                        $variant->stock = $resolvedStock;
                    }
                    $variant->status = 'active';
                    $variant->save();
                    $matchedVariantIds[] = $variant->id;
                } else {
                    // Jika varian baru ditambahkan dari form web, buatkan varian baru
                    $newVariantData = [
                        'product_id' => $product->id,
                        'variant_sku' => \App\Support\ShopeeStyleSku::nextVariantSku($product),
                        'price' => (float) ($combo['price'] ?? 0),
                        'stock' => $resolvedStock ?? 0,
                        'weight_kg' => $product->weight_kg,
                        'height_cm' => $product->height_cm,
                        'width_cm' => $product->width_cm,
                        'depth_cm' => $product->depth_cm,
                        'status' => 'active',
                        'created_by_user_id' => $request->user()->id,
                        'updated_by_user_id' => $request->user()->id,
                    ];
                    for ($s = 1; $s <= 5; $s++) {
                        $newVariantData['variation_'.$s.'_name'] = $slotNames[$s] ?? null;
                        $newVariantData['variation_'.$s.'_option'] = $options[$s - 1] ?? null;
                    }
                    $newV = \App\Models\ProductVariant::create($newVariantData);
                    $matchedVariantIds[] = $newV->id;
                }
            }

            // Arsipkan varian lama yang sengaja dihapus dari form kombinasi (tidak dihapus fisik)
            if ($matchedVariantIds !== []) {
                $product->variants()
                    ->whereNotIn('id', $matchedVariantIds)
                    ->where('status', '!=', 'archived')
                    ->update(['status' => 'archived']);
            }
        }

        // Normalisasi media: satu baris per asset PER KONTEKS. Satu aset boleh
        // dipakai sekaligus sebagai foto katalog DAN hasil pemasangan, jadi
        // deduplikasi harus memisahkan keduanya. Sebelumnya baris hasil
        // pemasangan ikut dihitung sebagai duplikat foto katalog, sehingga foto
        // yang dipakai di section Foto Produk terarsip lagi saat disimpan.
        $variantSeen = [];
        foreach ($product->media()->whereNotNull('product_variant_id')
            ->where('is_installation', false)
            ->orderByDesc('position')->orderBy('id')->get() as $m) {
            if (isset($variantSeen[$m->media_asset_id])) {
                $m->update(['visibility' => 'archived', 'show_in_catalog' => false, 'is_main_image' => false]);
                continue;
            }
            $variantSeen[$m->media_asset_id] = true;
            $m->update(['visibility' => 'visible', 'show_in_catalog' => true]);
        }
        $catalogSeen = [];
        foreach ($product->media()->whereNull('product_variant_id')
            ->where('is_installation', false)
            ->orderByDesc('is_main_image')->orderBy('position')->orderBy('id')->get() as $m) {
            if (isset($catalogSeen[$m->media_asset_id])) {
                $m->update(['visibility' => 'archived', 'show_in_catalog' => false, 'is_main_image' => false]);
                continue;
            }
            $catalogSeen[$m->media_asset_id] = true;
        }
        // Hasil pemasangan dikelola terpisah: deduplikasi hanya di dalam
        // konteksnya sendiri agar tidak bertabrakan dengan foto katalog.
        $installSeen = [];
        foreach ($product->media()->where('is_installation', true)
            ->orderBy('position')->orderBy('id')->get() as $m) {
            if (isset($installSeen[$m->media_asset_id])) {
                $m->update(['visibility' => 'archived', 'show_in_catalog' => false, 'is_main_image' => false]);
                continue;
            }
            $installSeen[$m->media_asset_id] = true;
        }

        if ($requestedStatus === 'active' && $wizardStep === null && $product->status === 'archived') {
            $publication->publish($product->fresh(), (int) $request->user()->id);
        }

        if ($wizardStep !== null) {
            return redirect()->route('admin.products.edit', [
                'product' => $product,
                'step' => $wizardStep,
            ])->with('success', 'Perubahan tersimpan.');
        }

        // Simpan sukses = keluar dari form, kembali ke daftar produk.
        return redirect()->route('admin.products.index')
            ->with('success', 'Produk '.$product->parent_sku.' berhasil diperbarui.');
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

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk '.$product->parent_sku.' dipublikasikan.');
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

    /**
     * Hapus permanen produk (hanya untuk produk yang belum pernah memiliki transaksi/pesanan).
     */
    public function destroy(Product $product): RedirectResponse
    {
        // Guard rail 1: Cek apakah ada riwayat pesanan yang merujuk ke produk atau variannya
        $variantIds = $product->variants()->pluck('id')->all();
        $hasOrders = \App\Models\OrderItem::where('product_id', $product->id)
            ->when($variantIds !== [], fn ($q) => $q->orWhereIn('product_variant_id', $variantIds))
            ->exists();

        if ($hasOrders) {
            return redirect()->back()->with('error', 'Produk tidak dapat dihapus permanen karena memiliki riwayat transaksi pesanan. Silakan gunakan opsi Arsipkan.');
        }

        // Guard rail 2: Hanya boleh hapus jika statusnya archived (mencegah penghapusan produk aktif secara keliru)
        if ($product->status === 'active') {
            return redirect()->back()->with('error', 'Arsipkan produk terlebih dahulu sebelum menghapus permanen.');
        }

        // Guard rail 3: produk masih terikat konfigurasi Teruskan Popularitas;
        // tanpa ini FK restrict melempar QueryException dan halaman 500.
        $hasBoost = $product->popularityBoostsAsSource()->exists()
            || $product->popularityBoostsAsTarget()->exists();

        if ($hasBoost) {
            return redirect()->back()->with('error', 'Produk tidak dapat dihapus permanen karena masih terdaftar di Teruskan Popularitas. Nonaktifkan konfigurasinya terlebih dahulu.');
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($product): void {
            $product->media()->delete();
            $product->attributes()->delete();
            $product->variants()->delete();
            $product->delete();
        });

        return redirect()->route('admin.products.index')
            ->with('success', 'Produk berhasil dihapus permanen.');
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
            // Klik nama produk = buka halaman DETAIL (bukan langsung ke form edit).
            // Form edit tetap terjangkau lewat aksi "Edit" per baris.
            'href' => route('admin.products.show', $product),
            'edit_href' => route('admin.products.edit', $product),
            'variants_href' => route('admin.products.edit', ['product' => $product, 'tab' => 'varian']),
            'media_href' => route('admin.products.edit', ['product' => $product, 'tab' => 'media']),
            'archive_url' => route('admin.products.archive', $product),
            'unarchive_url' => route('admin.products.unarchive', $product),
            'duplicate_url' => route('admin.products.duplicate', $product),
            'destroy_url' => route('admin.products.destroy', $product),
            'public_href' => route('product.show', $product->parent_sku),
        ];
    }

    /** @return array<string, mixed> */
    /** Kunci urutan yang dikenal; nilai asing jatuh ke urutan default. */
    private function resolveListSort(mixed $sort): string
    {
        $key = (string) $sort;

        return array_key_exists($key, self::SORT_OPTIONS) ? $key : self::DEFAULT_SORT;
    }

    /**
     * Terapkan urutan daftar produk. sold_count adalah alias agregat dari
     * withSum validOrderItems, jadi produk tanpa penjualan bernilai NULL dan
     * muncul lebih dulu pada urutan menaik.
     */
    private function applyListSort($query, string $sort): void
    {
        $option = self::SORT_OPTIONS[$sort];

        // id sebagai tie-break searah supaya urutan stabil antar halaman.
        $query->orderBy($option['column'], $option['direction'])
            ->orderBy('id', $option['direction']);
    }

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
            'sorts' => collect(self::SORT_OPTIONS)
                ->map(fn (array $option, string $value) => ['value' => $value, 'label' => $option['label']])
                ->values()
                ->all(),
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
