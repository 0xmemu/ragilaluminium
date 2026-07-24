<?php

namespace App\Services;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Support\CatalogLabels;
use App\Support\CatalogTaxonomy;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ModelProductService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function adminRows(?string $q = null, ?string $status = null): array
    {
        $query = CmsModelProduct::query()->orderBy('sort_order')->orderBy('id');

        if ($q) {
            $query->where(function ($builder) use ($q) {
                $builder->where('name', 'like', '%'.$q.'%')
                    ->orWhere('product_model', 'like', '%'.$q.'%')
                    ->orWhere('product_category', 'like', '%'.$q.'%');
            });
        }

        if (in_array($status, CmsModelProduct::STATUSES, true)) {
            $query->where('status', $status);
        }

        $items = $query->get();
        $stats = $this->statsByCategoryModel($items);

        return $items->values()->map(function (CmsModelProduct $item, int $index) use ($stats) {
            $key = $this->pairKey($item->product_category, $item->product_model);
            $stat = $stats[$key] ?? [
                'active_count' => 0,
                'archived_count' => 0,
                'variant_count' => 0,
                'designs' => [],
            ];

            return [
                'id' => $item->id,
                'no' => $index + 1,
                'name' => $item->name,
                'image_url' => $item->image_url,
                'type' => $item->type,
                'status' => $item->status,
                'sort_order' => $item->sort_order,
                'product_category' => $item->product_category,
                'product_model' => $item->product_model,
                'category_label' => CatalogLabels::category($item->product_category),
                'model_label' => CatalogLabels::model($item->product_model),
                'sub_models' => $stat['designs'],
                'sub_model_count' => count($stat['designs']),
                'active_count' => $stat['active_count'],
                'archived_count' => $stat['archived_count'],
                'variant_count' => $stat['variant_count'],
                'edit_href' => route('admin.model-products.edit', $item),
                'activate_url' => route('admin.model-products.activate', $item),
                'deactivate_url' => route('admin.model-products.deactivate', $item),
            ];
        })->all();
    }

    /**
     * Create missing CMS rows from distinct visible catalog models.
     */
    public function syncFromCatalog(?int $adminId = null): int
    {
        $pairs = Product::query()
            ->select('product_category', 'product_model')
            ->whereNotNull('product_category')
            ->whereNotNull('product_model')
            ->groupBy('product_category', 'product_model')
            ->get();

        $existing = CmsModelProduct::query()
            ->get(['product_category', 'product_model'])
            ->map(fn (CmsModelProduct $row) => $this->pairKey($row->product_category, $row->product_model))
            ->filter()
            ->all();

        $maxSort = (int) CmsModelProduct::query()->max('sort_order');
        $created = 0;
        $firstCreatedId = 0;

        foreach ($pairs as $pair) {
            $key = $this->pairKey($pair->product_category, $pair->product_model);
            if ($key === '' || in_array($key, $existing, true)) {
                continue;
            }

            $sample = Product::visible()
                ->with('mainImage')
                ->where('product_category', $pair->product_category)
                ->where('product_model', $pair->product_model)
                ->latest('id')
                ->first();

            $maxSort++;
            $item = CmsModelProduct::create([
                'name' => CatalogLabels::modelCardTitle($pair->product_category, $pair->product_model),
                'product_category' => $pair->product_category,
                'product_model' => $pair->product_model,
                'image_url' => $sample?->mainImage?->urlFor('card'),
                'type' => 'polos',
                'status' => 'active',
                'sort_order' => $maxSort,
            ]);
            $created++;
            $firstCreatedId = $firstCreatedId ?: (int) $item->id;
            $existing[] = $key;
        }

        if ($created > 0) {
            CatalogTaxonomy::forgetCache();
            ActivityLogService::record(
                'cms.model_products_synced',
                'cms_model_product',
                $firstCreatedId,
                ['created' => $created],
                $adminId,
            );
        }

        return $created;
    }

    /**
     * @param  list<array{id:int,sort_order?:int}>  $ordered
     */
    public function reorder(array $ordered, ?int $adminId = null): void
    {
        DB::transaction(function () use ($ordered) {
            foreach ($ordered as $index => $row) {
                $id = (int) ($row['id'] ?? 0);
                if ($id <= 0) {
                    continue;
                }
                CmsModelProduct::query()->whereKey($id)->update([
                    'sort_order' => (int) ($row['sort_order'] ?? $index),
                ]);
            }
        });

        CatalogTaxonomy::forgetCache();

        $entityId = (int) ($ordered[0]['id'] ?? CmsModelProduct::query()->value('id') ?? 0);
        if ($entityId > 0) {
            ActivityLogService::record(
                'cms.model_products_reordered',
                'cms_model_product',
                $entityId,
                ['count' => count($ordered)],
                $adminId,
            );
        }
    }

    /**
     * Storefront cards from active CMS rows; fallback to taxonomy when empty.
     *
     * @return list<array{title: string, count: string, meta: string, desc: string, image: ?string, href: string, model: string, category: string, designs: list<string>}>
     */
    public function storefrontCards(int $limit = 0, ?string $design = null): array
    {
        $rows = CmsModelProduct::query()->active()->get();
        if ($rows->isEmpty()) {
            return CatalogTaxonomy::modelCards($limit, $design);
        }

        $design = CatalogLabels::normalizeDesign($design);
        $stats = $this->statsByCategoryModel($rows);
        $cards = [];

        foreach ($rows as $row) {
            if (! $row->product_category || ! $row->product_model) {
                continue;
            }

            $productQuery = Product::visible()
                ->where('product_category', $row->product_category)
                ->where('product_model', $row->product_model)
                ->when($design, fn ($q) => $q->where('design_variant', $design));

            $count = (int) (clone $productQuery)->count();
            if ($design && $count === 0) {
                continue;
            }

            $key = $this->pairKey($row->product_category, $row->product_model);
            $designs = $stats[$key]['designs'] ?? [];

            $route = match ($row->product_category) {
                'DOOR' => 'catalog.doors',
                'BOUVEN' => 'catalog.bouven',
                default => 'catalog.windows',
            };

            $params = array_filter([
                'model' => $row->product_model,
                'design' => $design,
            ]);

            $image = $row->image_url;
            if (! $image) {
                $sample = (clone $productQuery)->with('mainImage')->latest('id')->first();
                $image = $sample?->mainImage?->urlFor('card');
            }
            if (! $image) {
                $image = '/'.ltrim((string) config('media.placeholder', 'images/home/product-flash.png'), '/');
            }

            $cards[] = [
                'title' => $row->name,
                'count' => (string) $count,
                'meta' => $this->metaFromDesigns($designs),
                'desc' => $this->descriptionFor($row->product_model),
                'image' => $image,
                'href' => CatalogLabels::modelShowcaseHref($row->product_category, $row->product_model),
                'catalog_href' => route($route, $params, absolute: false),
                'model' => $row->product_model,
                'category' => $row->product_category,
                'designs' => $designs,
            ];

            if ($limit > 0 && count($cards) >= $limit) {
                break;
            }
        }

        return $cards !== [] ? $cards : CatalogTaxonomy::modelCards($limit, $design);
    }

    /**
     * @param  Collection<int, CmsModelProduct>  $items
     * @return array<string, array{active_count:int,archived_count:int,variant_count:int,designs:list<string>}>
     */
    protected function statsByCategoryModel(Collection $items): array
    {
        $pairs = $items
            ->filter(fn (CmsModelProduct $item) => $item->product_category && $item->product_model)
            ->map(fn (CmsModelProduct $item) => [
                'category' => $item->product_category,
                'model' => $item->product_model,
            ])
            ->unique(fn (array $p) => $p['category'].'|'.$p['model'])
            ->values();

        if ($pairs->isEmpty()) {
            return [];
        }

        $products = Product::query()
            ->where(function ($q) use ($pairs) {
                foreach ($pairs as $pair) {
                    $q->orWhere(function ($inner) use ($pair) {
                        $inner->where('product_category', $pair['category'])
                            ->where('product_model', $pair['model']);
                    });
                }
            })
            ->get(['id', 'product_category', 'product_model', 'design_variant', 'status']);

        $productIds = $products->pluck('id')->all();
        $variantCounts = $productIds === []
            ? collect()
            : ProductVariant::query()
                ->select('product_id', DB::raw('count(*) as total'))
                ->whereIn('product_id', $productIds)
                ->groupBy('product_id')
                ->pluck('total', 'product_id');

        $out = [];
        foreach ($pairs as $pair) {
            $key = $this->pairKey($pair['category'], $pair['model']);
            $group = $products->filter(
                fn (Product $p) => $p->product_category === $pair['category'] && $p->product_model === $pair['model']
            );

            $designs = $group->pluck('design_variant')->filter()->unique()->values()
                ->map(fn ($d) => CatalogLabels::design($d) ?: $d)
                ->all();

            $out[$key] = [
                'active_count' => $group->where('status', 'active')->count(),
                'archived_count' => $group->where('status', 'archived')->count(),
                'variant_count' => (int) $group->sum(fn (Product $p) => (int) ($variantCounts[$p->id] ?? 0)),
                'designs' => $designs,
            ];
        }

        return $out;
    }

    protected function pairKey(?string $category, ?string $model): string
    {
        if (! $category || ! $model) {
            return '';
        }

        return strtoupper($category).'|'.strtoupper($model);
    }

    /** @param  list<string>  $designs */
    protected function metaFromDesigns(array $designs): string
    {
        if ($designs === []) {
            return 'Model katalog';
        }

        return implode(' · ', array_slice($designs, 0, 3));
    }

    protected function descriptionFor(string $model): string
    {
        return match (strtoupper($model)) {
            'JUNGKIT' => 'Jendela jungkit cocok untuk kamar mandi dan dapur. Aman dari cipratan air hujan sambil tetap memberi sirkulasi udara.',
            'SLIDING' => 'Jendela sliding cocok untuk ruangan dengan bukaan lebar dan memberikan kesan rapi pada rumah Anda.',
            'SWING' => 'Bukaan samping dengan engsel kokoh. Sirkulasi udara optimal untuk ruang tamu dan kamar tidur.',
            'KACA_MATI' => 'Pencahayaan maksimal tanpa daun bukaan. Ideal untuk area yang membutuhkan cahaya alami tanpa ventilasi aktif.',
            'ZIGZAG' => 'Boven zigzag untuk ventilasi memanjang di area tinggi. Sirkulasi udara merata tanpa mengorbankan privasi.',
            default => 'Pilih ukuran dan warna sesuai kebutuhan bangunan Anda.',
        };
    }

    /**
     * Public penjelasan-model page payload (Figma node model showcase).
     *
     * @return array{
     *   title: string,
     *   category: string,
     *   model: string,
     *   hero: array{image: string|null, caption: string|null},
     *   description: string,
     *   benefits: list<array{icon: string, title: string}>,
     *   specs: list<array{label: string, value: string}>,
     *   inspirations: list<array{id: string, image_url: string, label: string, href: string|null}>,
     *   pagination: array{current_page: int, last_page: int, per_page: int, total: int, from: int|null, to: int|null, links: list<array{url: ?string, label: string, active: bool}>},
     *   catalog_href: string,
     *   installations_href: string,
     *   back_href: string
     * }
     */
    public function showcase(string $categoryCode, string $modelCode, int $page = 1, int $perPage = 16): array
    {
        $categoryCode = strtoupper($categoryCode);
        $modelCode = CatalogLabels::normalizeModel($modelCode) ?? strtoupper($modelCode);

        $cms = CmsModelProduct::query()
            ->active()
            ->where('product_category', $categoryCode)
            ->where('product_model', $modelCode)
            ->first();

        $content = is_array($cms?->content) ? $cms->content : [];

        $title = filled($cms?->name)
            ? (string) $cms->name
            : CatalogLabels::modelCardTitle($categoryCode, $modelCode);

        $catalogRoute = match ($categoryCode) {
            'DOOR' => 'catalog.doors',
            'BOUVEN' => 'catalog.bouven',
            default => 'catalog.windows',
        };
        $catalogHref = route($catalogRoute, ['model' => $modelCode], absolute: false);

        $productQuery = Product::visible()
            ->where('product_category', $categoryCode)
            ->where('product_model', $modelCode);

        $heroImage = $content['hero_image_url']
            ?? $cms?->image_url
            ?? null;
        if (! $heroImage) {
            $sample = (clone $productQuery)->with('mainImage')->latest('id')->first();
            $heroImage = $sample?->mainImage?->urlFor('pdp')
                ?? $sample?->mainImage?->urlFor('card');
        }

        $description = trim((string) ($content['description'] ?? ''));
        if ($description === '') {
            $description = $this->descriptionFor($modelCode);
        }

        $benefits = $content['benefits'] ?? null;
        if (! is_array($benefits) || $benefits === []) {
            $benefits = [
                ['icon' => 'badge-check', 'title' => 'Kualitas terbaik dan terjamin'],
                ['icon' => 'sun', 'title' => 'Tahan panas dan cuaca'],
                ['icon' => 'shield-check', 'title' => 'Dukungan dan garansi pemasangan'],
            ];
        }

        $specs = $content['specs'] ?? null;
        if (! is_array($specs) || $specs === []) {
            $designCode = $cms?->type ? strtoupper((string) $cms->type) : 'POLOS';
            $specs = [
                ['label' => 'Kategori', 'value' => CatalogLabels::category($categoryCode)],
                ['label' => 'Model', 'value' => CatalogLabels::model($modelCode)],
                ['label' => 'Frame', 'value' => 'Aluminium'],
                ['label' => 'Tipe', 'value' => CatalogLabels::design($designCode) ?: 'Polos'],
            ];
        }

        $inspirations = $this->inspirationsForModel($categoryCode, $modelCode, max(1, $page), max(1, min(48, $perPage)));

        return [
            'title' => $title,
            'category' => $categoryCode,
            'model' => $modelCode,
            'hero' => [
                'image' => $heroImage,
                'caption' => filled($content['hero_caption'] ?? null)
                    ? (string) $content['hero_caption']
                    : null,
            ],
            'description' => $description,
            'benefits' => array_values(array_map(function ($row) {
                return [
                    'icon' => (string) ($row['icon'] ?? 'badge-check'),
                    'title' => (string) ($row['title'] ?? ''),
                ];
            }, $benefits)),
            'specs' => array_values(array_map(function ($row) {
                return [
                    'label' => (string) ($row['label'] ?? ''),
                    'value' => (string) ($row['value'] ?? ''),
                ];
            }, $specs)),
            'inspirations' => $inspirations['items'],
            'pagination' => $inspirations['pagination'],
            'catalog_href' => $catalogHref,
            'installations_href' => route('installation.index', absolute: false),
            'back_href' => route('catalog.index', absolute: false),
        ];
    }

    /**
     * @return array{
     *   items: list<array{id: string, image_url: string, label: string, href: string|null}>,
     *   pagination: array{current_page: int, last_page: int, per_page: int, total: int, from: int|null, to: int|null, links: list<array{url: ?string, label: string, active: bool}>}
     * }
     */
    protected function inspirationsForModel(string $categoryCode, string $modelCode, int $page, int $perPage): array
    {
        $emptyPagination = [
            'current_page' => 1,
            'last_page' => 1,
            'per_page' => $perPage,
            'total' => 0,
            'from' => null,
            'to' => null,
            'links' => [],
        ];

        $productIds = Product::visible()
            ->where('product_category', $categoryCode)
            ->where('product_model', $modelCode)
            ->pluck('id');

        if ($productIds->isEmpty()) {
            return ['items' => [], 'pagination' => $emptyPagination];
        }

        $paginator = ProductMedia::query()
            ->installation()
            ->visible()
            ->whereIn('product_id', $productIds)
            ->with(['product:id,parent_sku,name,short_name'])
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();

        $items = [];
        foreach ($paginator->items() as $item) {
            /** @var ProductMedia $item */
            $url = $item->urlFor('card')
                ?? $item->urlFor('thumb')
                ?? (config('media.allow_source_url_fallback') ? $item->source_url : null);
            if (! filled($url)) {
                continue;
            }
            $product = $item->product;
            $label = trim((string) ($product?->short_name ?: $product?->name ?: 'Hasil pemasangan'));
            $items[] = [
                'id' => 'media-'.$item->id,
                'image_url' => (string) $url,
                'label' => $label !== '' ? $label : 'Hasil pemasangan',
                'href' => $product?->parent_sku
                    ? route('installation.show', ['parent_sku' => $product->parent_sku], absolute: false)
                    : null,
            ];
        }

        return [
            'items' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
        ];
    }
}
