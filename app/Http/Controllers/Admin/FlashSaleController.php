<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Support\FlashSalePeriodSettings;
use App\Support\HomepagePromotions;
use App\Support\HomepagePromotionSettings;
use App\Support\InertiaAdmin;
use App\Support\ProductPromotionMetadata;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FlashSaleController extends Controller
{
    private const FLASH_NAMES = ['promo_flash_sale', 'flash_sale'];

    private const COMPARE_NAMES = [
        'promo_compare_price',
        'compare_price',
        'harga_asli',
        'harga_sebelum_diskon',
    ];

    public function index(Request $request): Response
    {
        $view = $request->input('view') === 'grid' ? 'grid' : 'list';
        $status = (string) $request->input('status', 'active');
        $q = trim((string) $request->input('q', ''));

        $trueValues = ['true', '1', 'yes', 'on'];
        $falseValues = ['false', '0', 'no', 'off'];

        $products = Product::query()
            ->with(['mainImage', 'activeVariants', 'attributes'])
            ->whereHas('attributes', function ($attr) use ($status, $trueValues, $falseValues) {
                $attr->whereIn('attribute_name', self::FLASH_NAMES);
                if ($status === 'active') {
                    $attr->where(function ($inner) use ($trueValues) {
                        foreach ($trueValues as $value) {
                            $inner->orWhereRaw('LOWER(attribute_value) = ?', [$value]);
                        }
                    });
                }
                if ($status === 'inactive') {
                    $attr->where(function ($inner) use ($falseValues) {
                        foreach ($falseValues as $value) {
                            $inner->orWhereRaw('LOWER(attribute_value) = ?', [$value]);
                        }
                    });
                }
            })
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('name', 'like', "%{$q}%")
                        ->orWhere('short_name', 'like', "%{$q}%")
                        ->orWhere('parent_sku', 'like', "%{$q}%");
                });
            })
            ->orderByDesc('updated_at')
            ->paginate(20)
            ->withQueryString();

        $cards = $products->getCollection()
            ->map(fn (Product $product) => $this->flashCard($product))
            ->values()
            ->all();

        $settings = HomepagePromotionSettings::get();
        $period = FlashSalePeriodSettings::publicState();

        return Inertia::render('Admin/FlashSale/Index', [
            'title' => 'Flash Sale',
            'description' => 'Atur jangka waktu kampanye, lalu tandai produk dengan promo_flash_sale dan harga coret (promo_compare_price). Periode disimpan di cms_pages.flash-sale.',
            'viewMode' => $view,
            'searchQuery' => $q,
            'activeStatus' => in_array($status, ['active', 'inactive', 'all'], true) ? $status : 'active',
            'products' => $cards,
            'pagination' => InertiaAdmin::pagination($products),
            'createHref' => route('admin.flash-sale.create'),
            'period' => $period,
            'periodUpdateUrl' => route('admin.flash-sale.period'),
            'bulkEnableUrl' => route('admin.flash-sale.bulk-enable'),
            'bulkDisableUrl' => route('admin.flash-sale.bulk-disable'),
            'summary' => [
                'active_count' => $this->countFlash(true),
                'inactive_count' => $this->countFlash(false),
                'auto_promotions_enabled' => $settings['enabled'],
                'auto_candidate_count' => HomepagePromotions::automaticCandidateCount(),
                'bannersHref' => route('admin.banners.index'),
                'period_status' => $period['status'],
                'period_live' => $period['live'],
            ],
        ]);
    }

    public function updatePeriod(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => [
                'nullable',
                'date',
                Rule::when($request->filled('starts_at'), ['after:starts_at']),
            ],
        ]);

        FlashSalePeriodSettings::update($validated, (int) $request->user()->id);

        return redirect()->route('admin.flash-sale.index')
            ->with('success', 'Periode Flash Sale disimpan.');
    }

    public function create(): Response
    {
        return Inertia::render('Admin/FlashSale/Form', [
            'product' => null,
            'productOptions' => $this->productOptions(),
            'submitUrl' => route('admin.flash-sale.store'),
            'method' => 'post',
            'indexHref' => route('admin.flash-sale.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateFlash($request);

        $product = Product::query()->findOrFail($validated['product_id']);
        $this->applyFlashAttributes(
            $product,
            flashSale: (bool) $validated['flash_sale'],
            comparePrice: $validated['compare_price'] ?? null,
            userId: (int) $request->user()->id,
        );

        return redirect()->route('admin.flash-sale.index')
            ->with('success', 'Flash Sale produk disimpan.');
    }

    public function edit(Product $product): Response
    {
        $product->load(['mainImage', 'activeVariants', 'attributes']);

        return Inertia::render('Admin/FlashSale/Form', [
            'product' => $this->flashCard($product),
            'productOptions' => [],
            'submitUrl' => route('admin.flash-sale.update', $product),
            'method' => 'put',
            'indexHref' => route('admin.flash-sale.index'),
        ]);
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $this->validateFlash($request, updating: true);

        $this->applyFlashAttributes(
            $product,
            flashSale: (bool) $validated['flash_sale'],
            comparePrice: $validated['compare_price'] ?? null,
            userId: (int) $request->user()->id,
        );

        return redirect()->route('admin.flash-sale.index')
            ->with('success', 'Flash Sale produk diperbarui.');
    }

    public function enable(Request $request, Product $product): RedirectResponse
    {
        $this->upsertNamedAttribute($product, 'promo_flash_sale', 'true', (int) $request->user()->id, self::FLASH_NAMES);

        return redirect()->back()->with('success', 'Flash Sale diaktifkan.');
    }

    public function bulkEnable(Request $request): RedirectResponse
    {
        return $this->applyBulkFlash($request, true);
    }

    public function bulkDisable(Request $request): RedirectResponse
    {
        return $this->applyBulkFlash($request, false);
    }

    public function disable(Request $request, Product $product): RedirectResponse
    {
        $this->upsertNamedAttribute($product, 'promo_flash_sale', 'false', (int) $request->user()->id, self::FLASH_NAMES);

        return redirect()->back()->with('success', 'Flash Sale dinonaktifkan.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateFlash(Request $request, bool $updating = false): array
    {
        return $request->validate([
            'product_id' => $updating
                ? ['nullable', 'integer']
                : ['required', 'integer', Rule::exists('products', 'id')],
            'flash_sale' => ['required', 'boolean'],
            'compare_price' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    private function applyFlashAttributes(
        Product $product,
        bool $flashSale,
        ?float $comparePrice,
        int $userId,
    ): void {
        $this->upsertNamedAttribute(
            $product,
            'promo_flash_sale',
            $flashSale ? 'true' : 'false',
            $userId,
            self::FLASH_NAMES,
        );

        if ($comparePrice === null) {
            return;
        }

        $this->upsertNamedAttribute(
            $product,
            'promo_compare_price',
            (string) round($comparePrice, 2),
            $userId,
            self::COMPARE_NAMES,
        );
    }

    /**
     * @param  list<string>  $aliases
     */
    private function upsertNamedAttribute(
        Product $product,
        string $canonicalName,
        string $value,
        int $userId,
        array $aliases,
    ): void {
        $existing = $product->attributes()
            ->whereIn('attribute_name', $aliases)
            ->orderByRaw('CASE WHEN attribute_name = ? THEN 0 ELSE 1 END', [$canonicalName])
            ->orderBy('id')
            ->first();

        if ($existing) {
            $existing->update([
                'attribute_name' => $canonicalName,
                'attribute_value' => $value,
                'source' => 'internal',
                'updated_by_user_id' => $userId,
            ]);

            return;
        }

        ProductAttribute::create([
            'product_id' => $product->id,
            'attribute_name' => $canonicalName,
            'attribute_value' => $value,
            'source' => 'internal',
            'created_by_user_id' => $userId,
            'updated_by_user_id' => $userId,
        ]);
    }

    /** @return array<string, mixed> */
    private function flashCard(Product $product): array
    {
        $promo = ProductPromotionMetadata::forProduct(
            $product,
            applyGlobalEventDiscount: false,
            respectFlashPeriod: false,
        );
        $flashAttr = $product->attributes
            ->first(fn (ProductAttribute $a) => in_array(strtolower($a->attribute_name), self::FLASH_NAMES, true));

        return [
            'id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'status' => $product->status,
            'image' => $product->mainImage?->urlFor('card'),
            'min_price' => $promo['min_price'],
            'compare_price' => $promo['compare_price'],
            'discount_percent' => $promo['discount_percent'],
            'flash_sale' => (bool) $promo['flash_sale'],
            'homepage_popular' => (bool) $product->homepage_popular,
            'auto_banner_eligible' => ProductPromotionMetadata::isEligibleForAutoBanner($product),
            'updated_at' => optional($flashAttr?->updated_at ?? $product->updated_at)?->toIso8601String(),
            'href' => route('admin.products.show', $product),
            'edit_href' => route('admin.flash-sale.edit', $product),
            'enable_url' => route('admin.flash-sale.enable', $product),
            'disable_url' => route('admin.flash-sale.disable', $product),
            'public_href' => route('product.show', $product->parent_sku),
        ];
    }

    /** @return list<array{id: int, parent_sku: string, name: string, min_price: float|null}> */
    private function productOptions(): array
    {
        return Product::query()
            ->with('activeVariants')
            ->where('status', 'active')
            ->orderBy('name')
            ->limit(300)
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'parent_sku' => $product->parent_sku,
                'name' => $product->name,
                'min_price' => $product->min_price !== null ? (float) $product->min_price : null,
            ])
            ->values()
            ->all();
    }

    private function countFlash(bool $active): int
    {
        $values = $active
            ? ['true', '1', 'yes', 'on']
            : ['false', '0', 'no', 'off'];

        return Product::query()
            ->whereHas('attributes', function ($attr) use ($values) {
                $attr->whereIn('attribute_name', self::FLASH_NAMES)
                    ->where(function ($inner) use ($values) {
                        foreach ($values as $value) {
                            $inner->orWhereRaw('LOWER(attribute_value) = ?', [$value]);
                        }
                    });
            })
            ->count();
    }

    /**
     * Terapkan status Flash Sale ke banyak produk sekaligus (program massal).
     *
     * @return RedirectResponse
     */
    private function applyBulkFlash(Request $request, bool $enabled): RedirectResponse
    {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1', 'max:500'],
            'product_ids.*' => ['integer', Rule::exists('products', 'id')],
        ]);

        $productIds = array_values(array_unique(array_map('intval', $validated['product_ids'])));
        $userId = (int) $request->user()->id;
        $count = 0;

        Product::query()
            ->whereIn('id', $productIds)
            ->get()
            ->each(function (Product $product) use ($enabled, $userId, &$count) {
                $this->upsertNamedAttribute(
                    $product,
                    'promo_flash_sale',
                    $enabled ? 'true' : 'false',
                    $userId,
                    self::FLASH_NAMES,
                );
                $count++;
            });

        $message = $enabled
            ? "Flash Sale diaktifkan untuk {$count} produk."
            : "Flash Sale dinonaktifkan untuk {$count} produk.";

        return redirect()->back()->with('success', $message);
    }
}
