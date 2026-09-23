<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Models\SubModel;
use App\Support\LikeSearch;
use App\Support\short_name;
use App\Services\CampaignService;
use App\Support\CatalogLabels;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class PromotionController extends Controller
{
    public function __construct(protected CampaignService $campaigns) {}

    public function index(Request $request): Response
    {
        $this->campaigns->autoEndExpired();

        $type = $request->input('type') === Promotion::TYPE_FLASH_SALE
            ? Promotion::TYPE_FLASH_SALE
            : Promotion::TYPE_STORE;

        $promotions = Promotion::query()
            ->where('type', $type)
            ->withCount('items')
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('Admin/Promotions', [
            'title' => $type === Promotion::TYPE_STORE ? 'Promo Toko' : 'Flash Sale',
            'description' => $type === Promotion::TYPE_STORE
                ? 'Promo diskon menyeluruh untuk produk terpilih. Satu produk hanya boleh di satu promo aktif; Flash Sale menggantikan promo.'
                : 'Flash Sale diskon ekstra. Hanya satu Flash Sale aktif; diskon wajib lebih besar dari Promo Toko.',
            'activeType' => $type,
            'typeOptions' => [
                ['value' => 'store', 'label' => 'Promo Toko'],
                ['value' => 'flash_sale', 'label' => 'Flash Sale'],
            ],
            'statusOptions' => $this->statusOptions(),
            'rows' => $promotions->map(fn (Promotion $p) => $this->row($p))->values()->all(),
            'createHref' => route('admin.promotions.create', ['type' => $type]),
        ]);
    }

    public function create(Request $request): Response
    {
        $type = $request->input('type') === Promotion::TYPE_FLASH_SALE
            ? Promotion::TYPE_FLASH_SALE
            : Promotion::TYPE_STORE;

        return Inertia::render('Admin/PromotionForm', [
            'backUrl' => route('admin.promotions.index', ['type' => $type]),
            'title' => $type === Promotion::TYPE_STORE ? 'Promo Toko Baru' : 'Flash Sale Baru',
            'promotion' => null,
            'submitUrl' => route('admin.promotions.store'),
            'indexUrl' => route('admin.promotions.index', ['type' => $type]),
            'options' => $this->formOptions($type),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateRequest($request);

        $campaign = new Promotion([
            'type' => $validated['type'],
            'name' => $validated['name'],
            'status' => Promotion::STATUS_DRAFT,
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'discount_percent' => $validated['discount_percent'],
            'created_by_user_id' => $request->user()->id,
            'updated_by_user_id' => $request->user()->id,
        ]);

        $this->campaigns->validate($campaign, $validated['targets']);
        $campaign->save();
        $this->saveItems($campaign, $validated['targets'], $request->user()->id);

        \App\Support\CampaignBannerSync::flush();
        \App\Services\ActivityLogService::record('product.promotion.created', 'promotion', $campaign->id, [
            'name' => $campaign->name,
            'type' => $campaign->type,
        ], (int) $request->user()->id);
        $this->campaigns->flushCache();

        return redirect()->route('admin.promotions.index', ['type' => $campaign->type])
            ->with('success', 'Kampanye "'.$campaign->name.'" dibuat sebagai draft.');
    }

    public function edit(Request $request, Promotion $promotion): Response|RedirectResponse
    {
        // Kampanye selesai/diakhiri sepenuhnya nonaktif (keputusan owner 2026-09-11):
        // dilarang diubah, alur yang benar adalah membuat kampanye baru.
        if (in_array($promotion->status, [Promotion::STATUS_ENDED, Promotion::STATUS_FINISHED], true)) {
            return redirect()
                ->route('admin.promotions.index', ['type' => $promotion->type])
                ->with('error', 'Kampanye yang sudah selesai atau diakhiri tidak dapat diubah. Buat kampanye baru.');
        }

        $promotion->load('items');

        return Inertia::render('Admin/PromotionForm', [
            'backUrl' => route('admin.promotions.index', ['type' => $promotion->type]),
            'title' => 'Edit '.($promotion->isFlashSale() ? 'Flash Sale' : 'Promo Toko'),
            'promotion' => [
                'id' => $promotion->id,
                'type' => $promotion->type,
                'name' => $promotion->name,
                'status' => $promotion->status,
                'starts_at' => optional($promotion->starts_at)?->format('Y-m-d\TH:i'),
                'ends_at' => optional($promotion->ends_at)?->format('Y-m-d\TH:i'),
                'discount_percent' => $promotion->discount_percent,
                'targets' => $promotion->items->map(fn (PromotionItem $item) => [
                    'target_type' => $item->target_type,
                    'target_id' => $item->target_type === PromotionItem::TARGET_PRODUCT ? (int) $item->target_id : (string) $item->target_id,
                    'excluded' => (bool) $item->excluded,
                    'override_discount_percent' => $item->override_discount_percent,
                ])->values()->all(),
            ],
            'submitUrl' => route('admin.promotions.update', $promotion),
            'indexUrl' => route('admin.promotions.index', ['type' => $promotion->type]),
            'options' => $this->formOptions($promotion->type),
        ]);
    }

    public function update(Request $request, Promotion $promotion): RedirectResponse
    {
        // Guard sama dengan edit(): kampanye mati tidak boleh diubah.
        if (in_array($promotion->status, [Promotion::STATUS_ENDED, Promotion::STATUS_FINISHED], true)) {
            return redirect()
                ->route('admin.promotions.index', ['type' => $promotion->type])
                ->with('error', 'Kampanye yang sudah selesai atau diakhiri tidak dapat diubah. Buat kampanye baru.');
        }

        $validated = $this->validateRequest($request);

        $promotion->fill([
            'name' => $validated['name'],
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'discount_percent' => $validated['discount_percent'],
            'updated_by_user_id' => $request->user()->id,
        ]);

        $this->campaigns->validate($promotion, $validated['targets'], $promotion->id);
        $promotion->save();
        $this->saveItems($promotion, $validated['targets'], $request->user()->id);

        \App\Support\CampaignBannerSync::flush();
        \App\Services\ActivityLogService::record('product.promotion.updated', 'promotion', $promotion->id, [
            'name' => $promotion->name,
        ], (int) $request->user()->id);
        $this->campaigns->flushCache();

        return redirect()->route('admin.promotions.index', ['type' => $promotion->type])
            ->with('success', 'Kampanye "'.$promotion->name.'" diperbarui.');
    }

    public function impact(Request $request, Promotion $promotion): JsonResponse
    {
        // Target otoritatif = items tersimpan. FE tidak mengirim targets utk
        // kampanye existing (requestTargets() mengembalikan [] bila tak ada
        // input) - mengirim [] eksplisit membuat validate gagal "Minimal satu
        // target" padahal kampanye valid (bug tombol Aktifkan 2026-09-04).
        $targets = $this->requestTargets($request);
        if ($targets === []) {
            $targets = $promotion->items->toArray();
        }

        try {
            $this->campaigns->validate($promotion, $targets, $promotion->id, isActivating: true);
        } catch (Throwable $e) {
            $errors = method_exists($e, 'errors') ? $e->errors() : ['Kampanye tidak valid.'];
            $errors = is_array($errors) ? array_values($errors) : [$errors];
            return response()->json([
                'ok' => false,
                'errors' => $errors,
            ], 422);
        }

        return response()->json([
            'ok' => true,
            ...$this->campaigns->affectedCounts($targets),
        ]);
    }

    public function activate(Request $request, Promotion $promotion): RedirectResponse
    {
        $this->campaigns->autoEndExpired();
        $this->campaigns->validate($promotion, $promotion->items->toArray(), $promotion->id, isActivating: true);

        if ($promotion->status === Promotion::STATUS_SCHEDULED || $request->boolean('start_now')) {
            $promotion->update([
                'starts_at' => now(),
            ]);
            $this->campaigns->activate($promotion, (int) $request->user()->id);
            $message = 'Kampanye "'.$promotion->name.'" aktif sekarang.';
        } elseif ($promotion->starts_at !== null && $promotion->starts_at->isFuture()) {
            $promotion->update([
                'status' => Promotion::STATUS_SCHEDULED,
                'updated_by_user_id' => $request->user()->id,
            ]);
            $this->campaigns->flushCache();
            $formattedStart = $promotion->starts_at->timezone(config('app.timezone'))->translatedFormat('d M Y, H.i').' WIB';
            $message = 'Kampanye "'.$promotion->name.'" dijadwalkan dan akan aktif otomatis pada '.$formattedStart.'.';
        } else {
            $this->campaigns->activate($promotion, (int) $request->user()->id);
            $message = 'Kampanye "'.$promotion->name.'" aktif.';
        }

        \App\Support\CampaignBannerSync::flush();

        return back()->with('success', $message);
    }

    public function end(Request $request, Promotion $promotion): RedirectResponse
    {
        $this->campaigns->endEarly($promotion, (int) $request->user()->id);
        \App\Support\CampaignBannerSync::flush();

        return back()->with('success', 'Kampanye "'.$promotion->name.'" diakhiri.');
    }

    private function row(Promotion $promotion): array
    {
        $productIds = $this->campaigns->resolveProductIds(
            collect($promotion->items)->map(fn (PromotionItem $item) => [
                'target_type' => $item->target_type,
                'target_id' => $item->target_id,
                'excluded' => $item->excluded,
            ])
        );

        return [
            'id' => $promotion->id,
            'name' => $promotion->name,
            'status' => $promotion->status,
            'discount_percent' => (int) $promotion->discount_percent,
            'starts_at' => optional($promotion->starts_at)?->toIso8601String(),
            'ends_at' => optional($promotion->ends_at)?->toIso8601String(),
            'items_count' => (int) ($promotion->items_count ?? $promotion->items->count()),
            'products_count' => $productIds->count(),
            'targets' => $promotion->items->map(fn (PromotionItem $item) => [
                'label' => $this->targetLabel($item),
                'excluded' => (bool) $item->excluded,
                'override_discount_percent' => $item->override_discount_percent,
            ])->values()->all(),
            'edit_href' => route('admin.promotions.edit', $promotion),
            'activate_url' => route('admin.promotions.activate', $promotion),
            'end_url' => route('admin.promotions.end', $promotion),
            'impact_url' => route('admin.promotions.impact', $promotion),
        ];
    }

    private function targetLabel(PromotionItem $item): string
    {
        return match ($item->target_type) {
            PromotionItem::TARGET_MODEL => 'Model '.CatalogLabels::model((string) $item->target_id),
            PromotionItem::TARGET_SUB_MODEL => 'Sub model '.CatalogLabels::design((string) $item->target_id),
            default => Product::whereKey((int) $item->target_id)->value('name') ?? '#'.$item->target_id,
        };
    }

    /** @return array<string, mixed> */
    private function validateRequest(Request $request): array
    {
        return $request->validate([
            'type' => ['required', 'in:store,flash_sale'],
            'name' => ['required', 'string', 'max:255'],
            'discount_percent' => ['required', 'integer', 'min:1', 'max:90'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'targets' => ['required', 'array', 'min:1'],
            'targets.*.target_type' => ['required', 'in:product,sub_model,model'],
            'targets.*.target_id' => ['required', 'string', 'max:100'],
            'targets.*.excluded' => ['sometimes', 'boolean'],
            'targets.*.override_discount_percent' => ['nullable', 'integer', 'min:1', 'max:90'],
        ], [], ['name' => 'Nama kampanye']);
    }

    /**
     * @return list<array{target_type: string, target_id: string, excluded: bool, override_discount_percent: int|null}>
     */
    private function requestTargets(Request $request): array
    {
        return collect($request->input('targets', []))
            ->map(fn (array $target) => [
                'target_type' => (string) $target['target_type'],
                'target_id' => (string) $target['target_id'],
                'excluded' => (bool) ($target['excluded'] ?? false),
                'override_discount_percent' => isset($target['override_discount_percent']) && $target['override_discount_percent'] !== '' && $target['override_discount_percent'] !== null
                    ? (int) $target['override_discount_percent']
                    : null,
            ])
            ->values()
            ->all();
    }

    private function saveItems(Promotion $campaign, array $targets, int $userId): void
    {
        $campaign->items()->delete();

        foreach ($targets as $target) {
            if (($target['excluded'] ?? false) && $target['target_type'] !== PromotionItem::TARGET_PRODUCT) {
                continue;
            }

            PromotionItem::create([
                'promotion_id' => $campaign->id,
                'target_type' => $target['target_type'],
                'target_id' => (string) $target['target_id'],
                'excluded' => (bool) ($target['excluded'] ?? false),
                'override_discount_percent' => isset($target['override_discount_percent']) && $target['override_discount_percent'] !== '' && $target['override_discount_percent'] !== null
                    ? (int) $target['override_discount_percent']
                    : null,
                'created_by_user_id' => $userId,
            ]);
        }
    }

    /** @return array<string, mixed> */
    public function products(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $category = trim((string) $request->query('category', ''));
        $model = trim((string) $request->query('model', ''));
        $perPage = min(50, max(10, (int) $request->query('per_page', 20)));

        $products = Product::query()
            ->where('status', 'active')
            ->when($q !== '', fn ($qry) => $qry->where(fn ($inner) =>
                LikeSearch::whereLike($inner, 'name', $q)
                    ->orWhereRaw('parent_sku LIKE ? ESCAPE ?', [LikeSearch::pattern($q), '\\'])
            ))
            ->when($category !== '', fn ($qry) => $qry->whereIn('product_category', \App\Support\CatalogLabels::categoryCodesWithLegacy($category)))
            ->when($model !== '', function ($qry) use ($model) {
                $modelPattern = str_replace(' ', '_', $model);
                $qry->where(function ($inner) use ($modelPattern) {
                    $inner->where('product_model', $modelPattern)
                        ->orWhere('product_model', 'LIKE', $modelPattern.'_%');
                });
            })
            ->withMin('activeVariants as min_price', 'price')
            ->orderBy('name')
            ->paginate($perPage)
            ->through(fn (Product $p) => [
                'id' => $p->id,
                'parent_sku' => $p->parent_sku,
                'name' => $p->name,
                'category' => $p->product_category,
                'model' => $p->product_model,
                'sub_model' => $p->design_variant,
                'price' => $p->min_price ? (float) $p->min_price : 0,
                'dimensions' => $p->short_name ?? '',
            ]);

        return response()->json($products);
    }

    private function formOptions(string $type): array
    {
        return [
            'type' => $type,
            'modelOptions' => collect(SubModel::MODELS)
                ->map(fn (string $m) => ['value' => $m, 'label' => CatalogLabels::model($m)])
                ->all(),
            'subModelOptions' => SubModel::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                // value = "model:code" - pasangan presisi (design_variant kode
                // sub model berulang antar model; "Polos" ada di 4 model).
                ->map(fn (SubModel $s) => ['value' => $s->product_model.':'.$s->code, 'model' => $s->product_model, 'label' => CatalogLabels::model($s->product_model).' · '.$s->name])
                ->all(),
            'productOptions' => Product::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'parent_sku', 'name', 'product_model'])
                ->map(fn (Product $p) => [
                    'value' => (string) $p->id,
                    'label' => $p->name.' ('.$p->parent_sku.')',
                    'model' => $p->product_model,
                ])
                ->all(),
        ];
    }

    /** @return list<array{value: string, label: string}> */
    private function statusOptions(): array
    {
        $labels = [
            Promotion::STATUS_DRAFT => 'Draft',
            Promotion::STATUS_SCHEDULED => 'Terjadwal',
            Promotion::STATUS_ACTIVE => 'Aktif',
            Promotion::STATUS_ENDED => 'Diakhiri',
            Promotion::STATUS_FINISHED => 'Selesai',
        ];

        return collect($labels)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values()->all();
    }
}
