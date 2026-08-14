<?php

namespace App\Support;

use App\Models\CmsPage;
use App\Models\CmsProblemSolution;
use Illuminate\Http\Request;
use App\Support\MediaNamer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Masalah & Solusi: cms_pages.slug = masalah-solusi + cms_problems_solutions.
 * Kolom `solution` bisa teks biasa atau JSON rich (foto/video/opsi solusi).
 */
class ProblemsSolutionsSettings
{
    public const PAGE_SLUG = 'masalah-solusi';

    public const MEDIA_DIRECTORY = 'masalah-solusi';

    public static function ensurePage(): CmsPage
    {
        return CmsPage::query()->firstOrCreate(
            ['slug' => self::PAGE_SLUG],
            [
                'title' => 'Masalah & Solusi',
                'content' => [
                    'heading' => 'Masalah & Solusi',
                    'subtitle' => 'Temukan solusi untuk masalah yang mungkin Anda hadapi.',
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
            'subtitle' => trim((string) ($content['subtitle'] ?? '')) ?: 'Temukan solusi untuk masalah yang mungkin Anda hadapi.',
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
            $parsed = self::parseForAdmin($item->solution);

            return [
                'id' => $item->id,
                'no' => $index + 1,
                'problem' => $item->problem,
                'solution' => $parsed['solution_preview'],
                'media_count' => count($parsed['photos']) + ($parsed['video']['src'] ?? null ? 1 : 0),
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
     *   items: list<array{id:int,problem:string,solution:array{type:string,content:mixed}}>
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
                'solution' => self::normalizeSolution($item->solution),
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
     * @return array{type:string,content:mixed}
     */
    public static function normalizeSolution(?string $solution): array
    {
        $solution = trim((string) $solution);
        if ($solution === '') {
            return [
                'type' => 'text',
                'content' => '',
            ];
        }

        $decoded = json_decode($solution, true);
        if (is_array($decoded) && ($decoded['type'] ?? '') === 'rich') {
            return [
                'type' => 'rich',
                'content' => $decoded,
            ];
        }

        return [
            'type' => 'text',
            'content' => $solution,
        ];
    }

    /**
     * @return array{
     *   solution_body: string,
     *   examples_label: string,
     *   examples_hint: string,
     *   photos: list<array{src:string,alt:string}>,
     *   video: array{src:?string,poster:?string,duration:?string}|null,
     *   solutions_label: string,
     *   solution_lead: string,
     *   solution_options: list<array{title:string,description:string,icon:string}>,
     *   whatsapp_note: string,
     *   solution_preview: string,
     *   use_options: bool
     * }
     */
    public static function parseForAdmin(?string $solution): array
    {
        $normalized = self::normalizeSolution($solution);

        if ($normalized['type'] === 'text') {
            $body = (string) $normalized['content'];

            return [
                'solution_body' => $body,
                'examples_label' => 'Contoh kondisi kerusakan',
                'examples_hint' => '',
                'photos' => [],
                'video' => null,
                'solutions_label' => 'Solusi yang kami tawarkan',
                'solution_lead' => '',
                'solution_options' => [],
                'whatsapp_note' => '',
                'solution_preview' => $body,
                'use_options' => false,
            ];
        }

        /** @var array<string, mixed> $content */
        $content = is_array($normalized['content']) ? $normalized['content'] : [];
        $photos = collect($content['photos'] ?? [])
            ->filter(fn ($photo) => is_array($photo) && filled($photo['src'] ?? null))
            ->map(fn (array $photo) => [
                'src' => (string) $photo['src'],
                'alt' => trim((string) ($photo['alt'] ?? '')),
            ])
            ->values()
            ->all();

        $video = null;
        if (is_array($content['video'] ?? null) && filled($content['video']['src'] ?? null)) {
            $video = [
                'src' => (string) $content['video']['src'],
                'poster' => filled($content['video']['poster'] ?? null) ? (string) $content['video']['poster'] : null,
                'duration' => filled($content['video']['duration'] ?? null) ? (string) $content['video']['duration'] : null,
            ];
        }

        $options = collect($content['options'] ?? [])
            ->filter(fn ($option) => is_array($option) && filled($option['title'] ?? null))
            ->map(fn (array $option) => [
                'title' => (string) $option['title'],
                'description' => (string) ($option['description'] ?? ''),
                'icon' => (string) ($option['icon'] ?? 'check-circle'),
            ])
            ->values()
            ->all();

        $body = trim((string) ($content['body'] ?? ''));

        return [
            'solution_body' => $body,
            'examples_label' => trim((string) ($content['examples_label'] ?? 'Contoh kondisi kerusakan')) ?: 'Contoh kondisi kerusakan',
            'examples_hint' => trim((string) ($content['examples_hint'] ?? '')),
            'photos' => $photos,
            'video' => $video,
            'solutions_label' => trim((string) ($content['solutions_label'] ?? 'Solusi yang kami tawarkan')) ?: 'Solusi yang kami tawarkan',
            'solution_lead' => trim((string) ($content['lead'] ?? '')),
            'solution_options' => $options,
            'whatsapp_note' => trim((string) ($content['whatsapp_note'] ?? '')),
            'solution_preview' => self::previewText($body, $options, count($photos), $video !== null),
            'use_options' => count($options) > 0,
        ];
    }

    /**
     * @param  list<array{title:string,description:string,icon:string}>  $options
     */
    public static function previewText(string $body, array $options, int $photoCount = 0, bool $hasVideo = false): string
    {
        if ($body !== '') {
            return $body;
        }

        if (count($options) > 0) {
            return collect($options)->pluck('title')->implode(' · ');
        }

        $parts = [];
        if ($photoCount > 0) {
            $parts[] = $photoCount.' foto';
        }
        if ($hasVideo) {
            $parts[] = 'video';
        }

        return count($parts) > 0 ? 'Dokumentasi: '.implode(', ', $parts) : '';
    }

    public static function buildSolutionFromRequest(Request $request, ?string $existingSolution = null): string
    {
        $existing = self::parseForAdmin($existingSolution);
        $body = trim((string) $request->input('solution_body', ''));
        $hint = trim((string) $request->input('examples_hint', ''));
        $examplesLabel = trim((string) $request->input('examples_label', 'Contoh kondisi kerusakan'));
        $solutionsLabel = trim((string) $request->input('solutions_label', 'Solusi yang kami tawarkan'));
        $lead = trim((string) $request->input('solution_lead', ''));
        $whatsappNote = trim((string) $request->input('whatsapp_note', ''));
        $useOptions = $request->boolean('use_options');

        $keptPhotos = collect(json_decode((string) $request->input('existing_photos', '[]'), true) ?: [])
            ->filter(fn ($photo) => is_array($photo) && filled($photo['src'] ?? null))
            ->map(fn (array $photo) => [
                'src' => (string) $photo['src'],
                'alt' => trim((string) ($photo['alt'] ?? '')),
            ])
            ->values()
            ->all();

        $newPhotoAlts = $request->input('photo_alts', []);
        if (! is_array($newPhotoAlts)) {
            $newPhotoAlts = [];
        }

        $photos = $keptPhotos;
        foreach ($request->file('photo_files', []) ?? [] as $index => $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }
            $photos[] = [
                'src' => self::storeMedia($file),
                'alt' => trim((string) ($newPhotoAlts[$index] ?? '')),
            ];
        }

        $videoUrl = trim((string) $request->input('video_url', ''));
        $videoDuration = trim((string) $request->input('video_duration', ''));
        $videoPoster = $existing['video']['poster'] ?? null;
        if ($request->hasFile('video_poster')) {
            $videoPoster = self::storeMedia($request->file('video_poster'));
        } elseif ($request->boolean('remove_video_poster')) {
            $videoPoster = null;
        }

        $video = null;
        if ($videoUrl !== '') {
            $video = [
                'src' => $videoUrl,
                'poster' => $videoPoster,
                'duration' => $videoDuration !== '' ? $videoDuration : null,
            ];
        }

        $options = [];
        if ($useOptions) {
            $rawOptions = json_decode((string) $request->input('solution_options', '[]'), true);
            if (is_array($rawOptions)) {
                foreach ($rawOptions as $option) {
                    if (! is_array($option) || ! filled($option['title'] ?? null)) {
                        continue;
                    }
                    $options[] = [
                        'title' => trim((string) $option['title']),
                        'description' => trim((string) ($option['description'] ?? '')),
                        'icon' => trim((string) ($option['icon'] ?? 'check-circle')) ?: 'check-circle',
                    ];
                }
            }
        }

        $hasRichPayload = $hint !== ''
            || count($photos) > 0
            || $video !== null
            || count($options) > 0
            || $lead !== ''
            || $whatsappNote !== '';

        if (! $hasRichPayload) {
            if ($body === '') {
                throw ValidationException::withMessages([
                    'solution_body' => 'Isi solusi atau unggah contoh dokumentasi.',
                ]);
            }

            return $body;
        }

        if ($body === '' && count($options) === 0) {
            throw ValidationException::withMessages([
                'solution_body' => 'Tambahkan teks solusi atau aktifkan daftar opsi solusi.',
            ]);
        }

        return json_encode([
            'type' => 'rich',
            'examples_label' => $examplesLabel !== '' ? $examplesLabel : 'Contoh kondisi kerusakan',
            'examples_hint' => $hint !== '' ? $hint : null,
            'photos' => $photos,
            'video' => $video,
            'body' => $body !== '' ? $body : null,
            'solutions_label' => $solutionsLabel !== '' ? $solutionsLabel : 'Solusi yang kami tawarkan',
            'lead' => $lead !== '' ? $lead : null,
            'options' => $options,
            'whatsapp_note' => $whatsappNote !== '' ? $whatsappNote : null,
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function storeMedia(UploadedFile $file): string
    {
        $name = MediaNamer::onDisk('masalah-solusi', $file->getClientOriginalExtension() ?: 'jpg', 'media', self::MEDIA_DIRECTORY);
        $path = $file->storeAs(self::MEDIA_DIRECTORY, $name, 'media');

        return Storage::disk('media')->url($path);
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
