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
    /**
     * Maksimal media per item Masalah & Solusi (kontrak owner 2026-09-20).
     * Foto dan video dihitung sebagai slot yang sama, jadi yang sah adalah
     * dua foto, dua video, atau satu foto dan satu video.
     */
    public const MAX_MEDIA_PER_ITEM = 2;

    public const PAGE_SLUG = 'masalah-solusi';

    public const MEDIA_DIRECTORY = 'masalah-solusi';

    public static function ensurePage(): CmsPage
    {
        $cached = CmsSettings::pageBySlug(self::PAGE_SLUG);
        if ($cached !== null) {
            return $cached;
        }

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
                'media_count' => count($parsed['media']),
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
            ->map(function (CmsProblemSolution $item) {
                $normalized = self::normalizeSolution($item->solution);

                // Baris lama menyimpan foto dan video pada dua kunci terpisah;
                // halaman publik kini hanya mengenal satu daftar `media`, jadi
                // keduanya disatukan di sini (tanpa mengubah data tersimpan).
                if ($normalized['type'] === 'rich' && is_array($normalized['content'])) {
                    $normalized['content']['media'] = self::mediaFromContent($normalized['content']);
                }

                return [
                    'id' => $item->id,
                    'problem' => $item->problem,
                    'solution' => $normalized,
                ];
            })
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
     *   video: array{src:?string,poster:?string,source:string,asset_id:?int}|null,
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
                'media' => [],
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
        // Kontrak owner 2026-09-30: satu daftar media berurutan, tanpa
        // memisahkan foto dan video.
        $media = self::mediaFromContent($content);

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
            'media' => $media,
            'solutions_label' => trim((string) ($content['solutions_label'] ?? 'Solusi yang kami tawarkan')) ?: 'Solusi yang kami tawarkan',
            'solution_lead' => trim((string) ($content['lead'] ?? '')),
            'solution_options' => $options,
            'whatsapp_note' => trim((string) ($content['whatsapp_note'] ?? '')),
            'solution_preview' => self::previewText($body, $options, $media),
            'use_options' => count($options) > 0,
        ];
    }

    /**
     * Daftar media berurutan dari isi JSON yang tersimpan.
     *
     * Bentuk baru menyimpan `media` sebagai satu daftar, urutannya pilihan
     * admin. Baris lama menyimpan `photos` lalu `video` terpisah; keduanya
     * disatukan di sini supaya data lama tetap tampil tanpa migrasi.
     *
     * @param  array<string, mixed>  $content
     * @return list<array<string, mixed>>
     */
    public static function mediaFromContent(array $content): array
    {
        $media = $content['media'] ?? null;
        if (is_array($media) && $media !== []) {
            $out = [];
            foreach ($media as $entry) {
                if (is_array($entry) && filled($entry['src'] ?? null)) {
                    $out[] = self::normalizeMediaEntry($entry);
                }
            }

            return $out;
        }

        // Bentuk lama: foto dulu, video di akhir (itu urutan render publik lama).
        $out = [];
        foreach (($content['photos'] ?? []) as $photo) {
            if (is_array($photo) && filled($photo['src'] ?? null)) {
                $out[] = self::normalizeMediaEntry(['kind' => 'image'] + $photo);
            }
        }
        if (is_array($content['video'] ?? null) && filled($content['video']['src'] ?? null)) {
            $out[] = self::normalizeMediaEntry(['kind' => 'video'] + $content['video']);
        }

        return $out;
    }

    /**
     * Samakan bentuk satu entri media, apa pun asalnya.
     *
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    private static function normalizeMediaEntry(array $entry): array
    {
        $kind = ($entry['kind'] ?? 'image') === 'video' ? 'video' : 'image';
        $base = [
            'kind' => $kind,
            'src' => (string) $entry['src'],
            'alt' => trim((string) ($entry['alt'] ?? '')),
        ];

        if ($kind === 'video') {
            $base['poster'] = filled($entry['poster'] ?? null) ? (string) $entry['poster'] : null;
            $base['source'] = ($entry['source'] ?? null) === 'library' ? 'library' : 'url';
            $base['asset_id'] = filled($entry['asset_id'] ?? null) ? (int) $entry['asset_id'] : null;

            return $base;
        }

        // Ukuran asli dipakai halaman publik untuk menentukan tata letak: media
        // lebar berdiri sendiri, media persegi dipasangkan berjejer.
        $base['width'] = filled($entry['width'] ?? null) ? (int) $entry['width'] : null;
        $base['height'] = filled($entry['height'] ?? null) ? (int) $entry['height'] : null;

        return $base;
    }

    /**
     * Daftar media dari permintaan form, berurutan sesuai pilihan admin.
     *
     * Isian `media` berbentuk JSON: tiap entri membawa `asset_id` (pilihan baru
     * dari Media Library) atau `src` (media lama yang dibiarkan apa adanya).
     *
     * Bila `media` tidak ada, bentuk lama tetap dilayani (foto dari
     * media_asset_ids lalu satu video dari media_video_asset_id), supaya tab
     * admin yang dibuka sebelum deploy tidak kehilangan medianya.
     *
     * @return list<array<string, mixed>>
     */
    public static function mediaFromRequest(Request $request): array
    {
        $raw = $request->input('media');
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }

        if (is_array($raw) && $raw !== []) {
            $alts = $request->input('photo_alts', []);
            $out = [];

            foreach (array_values($raw) as $index => $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                $alt = trim((string) ($entry['alt'] ?? (is_array($alts) ? ($alts[$index] ?? '') : '')));
                $assetId = (int) ($entry['asset_id'] ?? 0);

                if ($assetId > 0) {
                    $resolved = self::mediaFromAsset($assetId, $alt);
                    if ($resolved !== null) {
                        $out[] = $resolved;
                    }

                    continue;
                }

                if (filled($entry['src'] ?? null)) {
                    $out[] = self::normalizeMediaEntry(['alt' => $alt] + $entry);
                }
            }

            return $out;
        }

        return self::legacyMediaFromRequest($request);
    }

    /**
     * Bentuk permintaan lama: existing_photos + media_asset_ids + satu video.
     *
     * @return list<array<string, mixed>>
     */
    private static function legacyMediaFromRequest(Request $request): array
    {
        $alts = $request->input('photo_alts', []);
        if (! is_array($alts)) {
            $alts = [];
        }

        $out = [];
        $existing = json_decode((string) $request->input('existing_photos', '[]'), true);
        if (is_array($existing)) {
            foreach ($existing as $photo) {
                if (is_array($photo) && filled($photo['src'] ?? null)) {
                    $out[] = self::normalizeMediaEntry(['kind' => 'image'] + $photo);
                }
            }
        }

        $mediaAssetIds = array_values(array_filter(array_map(
            'intval',
            (array) $request->input('media_asset_ids', []),
        )));
        foreach ($mediaAssetIds as $index => $assetId) {
            $resolved = self::mediaFromAsset($assetId, trim((string) ($alts[$index] ?? '')));
            if ($resolved !== null) {
                $out[] = $resolved;
            }
        }

        if (filled($request->input('media_video_asset_id'))) {
            $resolved = self::mediaFromAsset((int) $request->input('media_video_asset_id'), '');
            if ($resolved !== null) {
                $out[] = $resolved;
            }
        }

        return $out;
    }

    /**
     * Satu entri media dari aset Media Library. Gambar memakai turunan pdp/card
     * beserta ukuran aslinya; video memakai berkas videonya sendiri dengan poster
     * dari aset itu (poster manual dihapus dari kontrak 2026-09-29).
     *
     * @return array<string, mixed>|null
     */
    private static function mediaFromAsset(int $assetId, string $alt): ?array
    {
        $asset = \App\Models\MediaAsset::query()
            ->where('status', 'ready')
            ->where('visibility', '!=', 'archived')
            ->find($assetId);

        if (! $asset) {
            return null;
        }

        $alt = trim($alt);
        $label = $alt !== '' ? $alt : (string) ($asset->label ?? '');

        if ($asset->kind === 'video') {
            return [
                'kind' => 'video',
                'src' => $asset->urlFor('video'),
                'alt' => $label,
                'poster' => $asset->urlFor('poster') ?? $asset->urlFor('card'),
                'source' => 'library',
                'asset_id' => (int) $asset->id,
            ];
        }

        return [
            'kind' => 'image',
            'src' => $asset->urlFor('pdp') ?? $asset->urlFor('card'),
            'alt' => $label,
            'width' => $asset->width_px ? (int) $asset->width_px : null,
            'height' => $asset->height_px ? (int) $asset->height_px : null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $options
     */
    public static function previewText(string $body, array $options, array $media = []): string
    {
        if ($body !== '') {
            return $body;
        }

        if (count($options) > 0) {
            return collect($options)->pluck('title')->implode(' · ');
        }

        $foto = count(array_filter($media, fn ($item) => ($item['kind'] ?? 'image') !== 'video'));
        $video = count($media) - $foto;

        $parts = [];
        if ($foto > 0) {
            $parts[] = $foto.' foto';
        }
        if ($video > 0) {
            $parts[] = $video.' video';
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

        // Media jadi satu daftar berurutan, tanpa memisahkan foto dan video
        // (kontrak owner 2026-09-30). Bentuk permintaan lama tetap diterima.
        $media = self::mediaFromRequest($request);
        if (count($media) > self::MAX_MEDIA_PER_ITEM) {
            throw ValidationException::withMessages([
                'media' => 'Maksimal '.self::MAX_MEDIA_PER_ITEM.' media per item.',
            ]);
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
            || count($media) > 0
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
            'media' => $media,
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
                ->update(['sort_order' => (int) ($row['sort_order'] ?? $index + 1)]);
        }
    }
}
