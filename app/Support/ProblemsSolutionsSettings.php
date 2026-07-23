<?php

namespace App\Support;

use App\Models\CmsPage;
use App\Models\CmsProblemSolution;

/**
 * Masalah & Solusi: cms_pages.slug = masalah-solusi + cms_problems_solutions.
 * Columns: problem, solution (migration) — stage-9a “problem_text/solution_text” = alias presentasi.
 */
class ProblemsSolutionsSettings
{
    public const PAGE_SLUG = 'masalah-solusi';

    public static function ensurePage(): CmsPage
    {
        return CmsPage::query()->firstOrCreate(
            ['slug' => self::PAGE_SLUG],
            [
                'title' => 'Masalah & Solusi',
                'content' => [
                    'heading' => 'Masalah & Solusi',
                    'subtitle' => 'Kendala umum di lapangan dan rekomendasi produk aluminium Ragil.',
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
            'title' => $page->title ?: 'Masalah & Solusi',
            'heading' => trim((string) ($content['heading'] ?? '')) ?: 'Masalah & Solusi',
            'subtitle' => trim((string) ($content['subtitle'] ?? '')) ?: 'Kendala umum di lapangan dan rekomendasi produk aluminium Ragil.',
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
        $content['heading'] = mb_substr(trim((string) ($payload['heading'] ?? $content['heading'] ?? 'Masalah & Solusi')), 0, 120) ?: 'Masalah & Solusi';
        $content['subtitle'] = mb_substr(trim((string) ($payload['subtitle'] ?? $content['subtitle'] ?? '')), 0, 320);

        $page->update([
            'title' => mb_substr(trim((string) ($payload['title'] ?? $page->title)), 0, 255) ?: 'Masalah & Solusi',
            'content' => $content,
            'published' => array_key_exists('published', $payload) ? (bool) $payload['published'] : $page->published,
            'updated_by_admin_id' => $adminId,
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function adminRows(?string $q = null): array
    {
        $pageId = self::pageId();
        $query = CmsProblemSolution::query()
            ->where('cms_page_id', $pageId)
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($q) {
            $query->where(function ($builder) use ($q) {
                $builder->where('problem', 'like', '%'.$q.'%')
                    ->orWhere('solution', 'like', '%'.$q.'%');
            });
        }

        return $query->get()->values()->map(function (CmsProblemSolution $item, int $index) {
            return [
                'id' => $item->id,
                'no' => $index + 1,
                'problem' => $item->problem,
                'solution' => $item->solution,
                'sort_order' => $item->sort_order,
                'edit_href' => route('admin.masalah-solusi.edit', $item),
                'destroy_url' => route('admin.masalah-solusi.destroy', $item),
            ];
        })->all();
    }

    /**
     * @return array{
     *   title: string,
     *   heading: string,
     *   subtitle: string,
     *   items: list<array{id:int,problem:string,solution:string}>
     * }
     */
    public static function forStorefront(): array
    {
        $meta = self::pageMeta();
        $items = CmsProblemSolution::query()
            ->where('cms_page_id', self::pageId())
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (CmsProblemSolution $item) => [
                'id' => $item->id,
                'problem' => $item->problem,
                'solution' => $item->solution,
            ])
            ->values()
            ->all();

        return [
            'title' => $meta['title'],
            'heading' => $meta['heading'],
            'subtitle' => $meta['subtitle'],
            'items' => $items,
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
            CmsProblemSolution::query()
                ->where('cms_page_id', $pageId)
                ->whereKey($id)
                ->update(['sort_order' => (int) ($row['sort_order'] ?? $index)]);
        }
    }
}
