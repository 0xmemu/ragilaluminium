<?php

namespace App\Support;

use App\Models\CmsFaqItem;
use App\Models\CmsPage;
use Illuminate\Support\Collection;

/**
 * FAQ page + items: cms_pages.slug = faq + cms_faq_items.
 */
class FaqSettings
{
    public const PAGE_SLUG = 'faq';

    /** @var list<string> */
    public const CATEGORIES = [
        'Umum & Profil Toko',
        'Spesifikasi Material & Ukuran',
        'Metode Pembayaran',
        'Pengiriman & Pemasangan',
    ];

    /** @var list<string> */
    public const STATUSES = [
        CmsFaqItem::STATUS_ACTIVE,
        CmsFaqItem::STATUS_ARCHIVED,
    ];

    /**
     * @return list<array{value:string,label:string}>
     */
    public static function categoryOptions(): array
    {
        return array_map(
            fn (string $category) => ['value' => $category, 'label' => $category],
            self::CATEGORIES,
        );
    }

    public static function ensurePage(): CmsPage
    {
        return CmsPage::query()->firstOrCreate(
            ['slug' => self::PAGE_SLUG],
            [
                'title' => 'Sering Ditanyakan',
                'content' => [
                    'heading' => 'Sering Ditanyakan',
                    'subtitle' => 'Jawaban singkat untuk pertanyaan yang paling sering diajukan pembeli.',
                ],
                'published' => true,
            ],
        );
    }

    public static function pageId(): int
    {
        return (int) self::ensurePage()->id;
    }

    /**
     * @return array{title:string,heading:string,subtitle:string,published:bool}
     */
    public static function pageMeta(): array
    {
        $page = self::ensurePage();
        $content = is_array($page->content) ? $page->content : [];

        return [
            'title' => $page->title ?: 'Sering Ditanyakan',
            'heading' => trim((string) ($content['heading'] ?? '')) ?: 'Sering Ditanyakan',
            'subtitle' => trim((string) ($content['subtitle'] ?? '')) ?: 'Jawaban singkat untuk pertanyaan yang paling sering diajukan pembeli.',
            'published' => (bool) $page->published,
        ];
    }

    /**
     * @param  array{title?:string,heading?:string,subtitle?:string,published?:bool}  $payload
     */
    public static function updatePageMeta(array $payload, ?int $adminId = null): void
    {
        $page = self::ensurePage();
        $content = is_array($page->content) ? $page->content : [];
        $content['heading'] = mb_substr(trim((string) ($payload['heading'] ?? $content['heading'] ?? 'Sering Ditanyakan')), 0, 120) ?: 'Sering Ditanyakan';
        $content['subtitle'] = mb_substr(trim((string) ($payload['subtitle'] ?? $content['subtitle'] ?? '')), 0, 320);

        $page->update([
            'title' => mb_substr(trim((string) ($payload['title'] ?? $page->title)), 0, 255) ?: 'Sering Ditanyakan',
            'content' => $content,
            'published' => array_key_exists('published', $payload) ? (bool) $payload['published'] : $page->published,
            'updated_by_admin_id' => $adminId,
        ]);
    }

    public static function normalizeCategory(?string $category): string
    {
        $category = trim((string) $category);

        return in_array($category, self::CATEGORIES, true)
            ? $category
            : self::CATEGORIES[0];
    }

    public static function normalizeStatus(?string $status): string
    {
        $status = trim((string) $status);

        return in_array($status, self::STATUSES, true)
            ? $status
            : CmsFaqItem::STATUS_ACTIVE;
    }

    /**
     * @return array{active:int,archived:int}
     */
    public static function statusCounts(): array
    {
        $pageId = self::pageId();

        return [
            'active' => (int) CmsFaqItem::query()
                ->where('cms_page_id', $pageId)
                ->where('status', CmsFaqItem::STATUS_ACTIVE)
                ->count(),
            'archived' => (int) CmsFaqItem::query()
                ->where('cms_page_id', $pageId)
                ->where('status', CmsFaqItem::STATUS_ARCHIVED)
                ->count(),
        ];
    }

    /**
     * Admin list rows for one status tab.
     *
     * @return list<array<string, mixed>>
     */
    public static function adminRows(
        string $status = CmsFaqItem::STATUS_ACTIVE,
        ?string $q = null,
        ?string $category = null,
    ): array {
        $pageId = self::pageId();
        $status = self::normalizeStatus($status);

        $query = CmsFaqItem::query()
            ->where('cms_page_id', $pageId)
            ->where('status', $status)
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($q) {
            $query->where(function ($builder) use ($q) {
                $builder->where('question', 'like', '%'.$q.'%')
                    ->orWhere('answer', 'like', '%'.$q.'%');
            });
        }

        if ($category && in_array($category, self::CATEGORIES, true)) {
            $query->where('category', $category);
        }

        return $query->get()->values()->map(function (CmsFaqItem $item, int $index) {
            return [
                'id' => $item->id,
                'no' => $index + 1,
                'question' => $item->question,
                'answer' => $item->answer,
                'category' => $item->category,
                'status' => $item->status,
                'sort_order' => $item->sort_order,
                'archive_url' => route('admin.faq.archive', $item, absolute: false),
                'unarchive_url' => route('admin.faq.unarchive', $item, absolute: false),
                'destroy_url' => route('admin.faq.destroy', $item, absolute: false),
            ];
        })->all();
    }

    /**
     * Storefront: groups by category (active items only).
     *
     * @return array{
     *   title: string,
     *   heading: string,
     *   subtitle: string,
     *   categories: list<array{key:string,label:string,count:int}>,
     *   groups: list<array{category:string,items:list<array{id:int,question:string,answer:string}>}>
     * }
     */
    public static function forStorefront(): array
    {
        $meta = self::pageMeta();
        $items = CmsFaqItem::query()
            ->where('cms_page_id', self::pageId())
            ->where('status', CmsFaqItem::STATUS_ACTIVE)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $byCategory = $items->groupBy(fn (CmsFaqItem $item) => self::normalizeCategory($item->category));

        $groups = [];
        $categories = [];
        foreach (self::CATEGORIES as $category) {
            /** @var Collection<int, CmsFaqItem> $group */
            $group = $byCategory->get($category, collect());
            if ($group->isEmpty()) {
                continue;
            }
            $categories[] = [
                'key' => $category,
                'label' => $category,
                'count' => $group->count(),
            ];
            $groups[] = [
                'category' => $category,
                'items' => $group->map(fn (CmsFaqItem $item) => [
                    'id' => $item->id,
                    'question' => $item->question,
                    'answer' => $item->answer,
                ])->values()->all(),
            ];
        }

        return [
            'title' => $meta['title'],
            'heading' => $meta['heading'],
            'subtitle' => $meta['subtitle'],
            'categories' => $categories,
            'groups' => $groups,
        ];
    }

    /**
     * @param  list<array{id:int,sort_order?:int}>  $ordered
     */
    public static function reorder(array $ordered): void
    {
        $pageId = self::pageId();
        foreach ($ordered as $index => $row) {
            $id = (int) ($row['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            CmsFaqItem::query()
                ->where('cms_page_id', $pageId)
                ->whereKey($id)
                ->update(['sort_order' => (int) ($row['sort_order'] ?? $index)]);
        }
    }
}
