<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Models\SubModel;
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
            'sync_banner' => $validated['sync_banner'],
            'created_by_user_id' => $request->user()->id,
            'updated_by_user_id' => $request->user()->id,
        ]);

        $this->campaigns->validate($campaign, $validated['targets']);
        $campaign->save();
        $this->saveItems($campaign, $validated['targets'], $request->user()->id);

        \App\Services\ActivityLogService::record('product.promotion.created', 'promotion', $campaign->id, [
            'name' => $campaign->name,
            'type' => $campaign->type,
        ], (int) $request->user()->id);
        $this->campaigns->flushCache();

        return redirect()->route('admin.promotions.index', ['type' => $campaign->type])
            ->with('success', 'Kampanye "'.$campaign->name.'" dibuat sebagai draft.');
    }

    public function edit(Request $request, Promotion $promotion): Response
    {
        $promotion->load('items');

        return Inertia::render('Admin/PromotionForm', [
            'title' => 'Edit '.($promotion->isFlashSale() ? 'Flash Sale' : 'Promo Toko'),
            'promotion' => [
                'id' => $promotion->id,
                'type' => $promotion->type,
                'name' => $promotion->name,
                'status' => $promotion->status,
                'starts_at' => optional($promotion->starts_at)?->format('Y-m-d\TH:i'),
                'ends_at' => optional($promotion->ends_at)?->format('Y-m-d\TH:i'),
                'discount_percent' => $promotion->discount_percent,
                'sync_banner' => (bool) $promotion->sync_banner,
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
        $validated = $this->validateRequest($request);

        $promotion->fill([
            'name' => $validated['name'],
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'discount_percent' => $validated['discount_percent'],
            'sync_banner' => $validated['sync_banner'],
            'updated_by_user_id' => $request->user()->id,
        ]);

        $this->campaigns->validate($promotion, $validated['targets'], $promotion->id);
        $promotion->save();
        $this->saveItems($promotion, $validated['targets'], $request->user()->id);

        \App\Services\ActivityLogService::record('product.promotion.updated', 'promotion', $promotion->id, [
            'name' => $promotion->name,
        ], (int) $request->user()->id);
        $this->campaigns->flushCache();

        return redirect()->route('admin.promotions.index', ['type' => $promotion->type])
            ->with('success', 'Kampanye "'.$promotion->name.'" diperbarui.');
    }

    public function impact(Request $request, Promotion $promotion): JsonResponse
    {
        try {
            $this->campaigns->validate($promotion, $this->requestTargets($request), $promotion->id);
        } catch (Throwable $e) {
            return response()->json([
                'ok' => false,
                'errors' => method_exists($e, 'errors') ? $e->errors() : ['Kampanye tidak valid.'],
            ], 422);
        }

        return response()->json([
            'ok' => true,
            ...$this->campaigns->affectedCounts($this->requestTargets($request)),
        ]);
    }

    public function activate(Request $request, Promotion $promotion): RedirectResponse
    {
        $this->campaigns->validate($promotion, $promotion->items->toArray(), $promotion->id);

        if ($promotion->starts_at !== null && $promotion->starts_at->isFuture()) {
            $promotion->update([
                'status' => Promotion::STATUS_SCHEDULED,
                'updated_by_user_id' => $request->user()->id,
            ]);
        } else {
            $this->campaigns->activate($promotion, (int) $request->user()->id);
        }

        return back()->with('success', 'Kampanye "'.$promotion->name.'" aktif.');
    }

    public function end(Request $request, Promotion $promotion): RedirectResponse
    {
        $this->campaigns->endEarly($promotion, (int) $request->user()->id);

        return back()->with('success', 'Kampanye "'.$promotion->name.'" diakhiri.');
    }

    public function duplicate(Request $request, Promotion $promotion): RedirectResponse
    {
        $copy = $this->campaigns->duplicate($promotion, (int) $request->user()->id);

        return redirect()->route('admin.promotions.edit', $copy)
            ->with('success', 'Kampanye disalin. Periksa lalu aktifkan.');
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
            'sync_banner' => (bool) $promotion->sync_banner,
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
            'duplicate_url' => route('admin.promotions.duplicate', $promotion),
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
            'sync_banner' => ['sometimes', 'boolean'],
            'targets' => ['required', 'array', 'min:1'],
            'targets.*.target_type' => ['required', 'in:product,sub_model,model'],
            'targets.*.target_id' => ['required', 'string', 'max:100'],
            'targets.*.excluded' => ['sometimes', 'boolean'],
            'targets.*.override_discount_percent' => ['nullable', 'integer', 'min:1', 'max:90'],
        ]);
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
                ->map(fn (SubModel $s) => ['value' => (string) $s->id, 'model' => $s->product_model, 'label' => CatalogLabels::model($s->product_model).' · '.$s->name])
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
