<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsFaqItem;
use App\Services\ActivityLogService;
use App\Support\FaqSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FaqController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->input('q', ''));
        $category = (string) $request->input('category', '');
        $status = FaqSettings::normalizeStatus((string) $request->input('status', CmsFaqItem::STATUS_ACTIVE));
        $counts = FaqSettings::statusCounts();

        return Inertia::render('Admin/Faq/Index', [
            'title' => 'Sering Ditanyakan',
            'description' => 'Kelola pertanyaan FAQ yang tampil di toko. Arsipkan yang jarang dipakai tanpa menghapus.',
            'filters' => [
                'q' => $q,
                'category' => in_array($category, FaqSettings::CATEGORIES, true) ? $category : '',
                'status' => $status,
            ],
            'statusCounts' => $counts,
            'categoryOptions' => array_merge(
                [['value' => '', 'label' => 'Semua kategori']],
                FaqSettings::categoryOptions(),
            ),
            'rows' => FaqSettings::adminRows(
                $status,
                $q !== '' ? $q : null,
                in_array($category, FaqSettings::CATEGORIES, true) ? $category : null,
            ),
            'pageMeta' => FaqSettings::pageMeta(),
            'categories' => FaqSettings::CATEGORIES,
            'storeUrl' => route('admin.faq.store', absolute: false),
            'reorderUrl' => route('admin.faq.reorder', absolute: false),
            'metaUrl' => route('admin.faq.meta.update', absolute: false),
            'previewUrl' => route('faq', absolute: false),
            'openCreate' => $request->boolean('create'),
            'openMeta' => $request->boolean('meta'),
        ]);
    }

    public function updateMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:320'],
            'published' => ['sometimes', 'boolean'],
        ]);
        $validated['published'] = (bool) ($validated['published'] ?? false);

        FaqSettings::updatePageMeta($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.faq_meta_updated',
            'cms_page',
            FaqSettings::pageId(),
            ['heading' => $validated['heading']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.faq.index', ['meta' => 1])
            ->with('success', 'Meta halaman FAQ disimpan.');
    }

    public function create(): RedirectResponse
    {
        return redirect()->route('admin.faq.index', ['create' => 1]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['cms_page_id'] = FaqSettings::pageId();
        $validated['status'] = CmsFaqItem::STATUS_ACTIVE;
        $validated['sort_order'] = ((int) CmsFaqItem::query()
            ->where('cms_page_id', $validated['cms_page_id'])
            ->where('status', CmsFaqItem::STATUS_ACTIVE)
            ->max('sort_order')) + 1;

        $item = CmsFaqItem::create($validated);

        ActivityLogService::record(
            'cms.faq_item_created',
            'cms_faq_item',
            (int) $item->id,
            ['question' => $item->question],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.faq.index', ['status' => CmsFaqItem::STATUS_ACTIVE])
            ->with('success', 'FAQ ditambahkan.');
    }

    public function edit(CmsFaqItem $faq): RedirectResponse
    {
        return redirect()->route('admin.faq.index', [
            'status' => FaqSettings::normalizeStatus($faq->status),
        ]);
    }

    public function update(Request $request, CmsFaqItem $faq): RedirectResponse
    {
        $validated = $this->validated($request);
        $faq->update($validated);

        ActivityLogService::record(
            'cms.faq_item_updated',
            'cms_faq_item',
            (int) $faq->id,
            ['question' => $faq->question],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.faq.index', ['status' => FaqSettings::normalizeStatus($faq->status)])
            ->with('success', 'FAQ diperbarui.');
    }

    public function archive(Request $request, CmsFaqItem $faq): RedirectResponse
    {
        $faq->update(['status' => CmsFaqItem::STATUS_ARCHIVED]);

        ActivityLogService::record(
            'cms.faq_item_archived',
            'cms_faq_item',
            (int) $faq->id,
            ['question' => $faq->question],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.faq.index', ['status' => CmsFaqItem::STATUS_ACTIVE])
            ->with('success', 'FAQ diarsipkan.');
    }

    public function unarchive(Request $request, CmsFaqItem $faq): RedirectResponse
    {
        $faq->update([
            'status' => CmsFaqItem::STATUS_ACTIVE,
            'sort_order' => ((int) CmsFaqItem::query()
                ->where('cms_page_id', $faq->cms_page_id)
                ->where('status', CmsFaqItem::STATUS_ACTIVE)
                ->max('sort_order')) + 1,
        ]);

        ActivityLogService::record(
            'cms.faq_item_unarchived',
            'cms_faq_item',
            (int) $faq->id,
            ['question' => $faq->question],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.faq.index', ['status' => CmsFaqItem::STATUS_ACTIVE])
            ->with('success', 'FAQ diaktifkan kembali.');
    }

    public function destroy(Request $request, CmsFaqItem $faq): RedirectResponse
    {
        $id = (int) $faq->id;
        $question = $faq->question;
        $status = FaqSettings::normalizeStatus($faq->status);
        $faq->delete();

        ActivityLogService::record(
            'cms.faq_item_deleted',
            'cms_faq_item',
            $id,
            ['question' => $question],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.faq.index', ['status' => $status])
            ->with('success', 'FAQ dihapus permanen.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:cms_faq_items,id'],
            'rows.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        FaqSettings::reorder($validated['rows']);

        ActivityLogService::record(
            'cms.faq_items_reordered',
            'cms_page',
            FaqSettings::pageId(),
            ['count' => count($validated['rows'])],
            $request->user()?->id,
        );

        $status = FaqSettings::normalizeStatus((string) $request->input('status', CmsFaqItem::STATUS_ACTIVE));

        return redirect()
            ->route('admin.faq.index', ['status' => $status])
            ->with('success', 'Urutan FAQ disimpan.');
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request): array
    {
        $validated = $request->validate([
            'question' => ['required', 'string', 'max:255'],
            'answer' => ['required', 'string', 'max:5000'],
            'category' => ['required', 'string', Rule::in(FaqSettings::CATEGORIES)],
        ]);

        $validated['category'] = FaqSettings::normalizeCategory($validated['category']);

        return $validated;
    }
}
