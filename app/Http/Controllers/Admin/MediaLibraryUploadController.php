<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\DownloadMediaAsset;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Support\MediaNamer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Upload langsung ke Media Library (single/multiple/folder dari client).
 *
 * object_key SELALU immutable: media/library/{year}/{month}/{uuid}.{ext}.
 * folder_id hanya metadata organisasi; rename/move folder tidak menyentuh key.
 */
class MediaLibraryUploadController extends Controller
{
    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'media' => ['required', 'file'],
            'folder_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('media');
        $mime = strtolower((string) $file->getMimeType());
        $kind = str_starts_with($mime, 'video/') ? 'video' : 'image';

        $allowed = $kind === 'video'
            ? (array) config('media.allowed_video_mime', [])
            : (array) config('media.allowed_mime', []);
        if (! in_array($mime, $allowed, true)) {
            return response()->json(['message' => "Tipe file tidak diizinkan: {$mime}"], 422);
        }

        $maxBytes = $kind === 'video'
            ? (int) config('media.max_video_bytes', 50 * 1024 * 1024)
            : (int) config('media.max_bytes', 10 * 1024 * 1024);
        if ($file->getSize() > $maxBytes) {
            return response()->json(['message' => "Ukuran file melebihi batas {$maxBytes} byte"], 422);
        }

        $extension = strtolower($file->getClientOriginalExtension() ?: ($kind === 'video' ? 'mp4' : 'jpg'));
        $extension = preg_replace('/[^a-z0-9]/', '', $extension) ?: ($kind === 'video' ? 'mp4' : 'jpg');

        $key = sprintf(
            'media/library/%s/%s/%s.%s',
            now()->format('Y'),
            now()->format('m'),
            Str::uuid()->toString(),
            $extension
        );

        $disk = Storage::disk(config('media.disk', 'media'));
        $disk->put($key, file_get_contents($file->getRealPath()), ['ContentType' => $mime]);

        $label = trim((string) ($validated['label'] ?? $file->getClientOriginalName())) ?: 'media';
        $asset = MediaAsset::create([
            'kind' => $kind,
            'label' => $label,
            'object_key' => $key,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
            'status' => 'ready',
            'visibility' => 'visible',
            'folder_id' => $validated['folder_id'] ?? null,
            'created_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'asset' => [
                'id' => $asset->id,
                'label' => $asset->label,
                'kind' => $asset->kind,
                'status' => $asset->status,
                'public_url' => $disk->url($key),
                'folder_id' => $asset->folder_id,
            ],
        ], 201);
    }

    /** Impor dari URL -> asset pending + download (pipeline existing). */
    public function importUrl(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_url' => ['required', 'url', 'max:2048'],
            'folder_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
        ]);

        $hash = hash('sha256', $validated['source_url']);
        $existing = MediaAsset::where('source_url_hash', $hash)->first();
        if ($existing) {
            if ($validated['folder_id']) {
                $existing->update(['folder_id' => $validated['folder_id']]);
            }

            return response()->json(['message' => 'URL sudah ada di library; aset dikembalikan.', 'asset_id' => $existing->id], 200);
        }

        $asset = MediaAsset::create([
            'kind' => 'image',
            'label' => basename(parse_url($validated['source_url'], PHP_URL_PATH) ?: 'media'),
            'source_url' => $validated['source_url'],
            'source_url_hash' => $hash,
            'status' => 'pending',
            'visibility' => 'visible',
            'folder_id' => $validated['folder_id'] ?? null,
            'created_by_user_id' => $request->user()->id,
        ]);

        DownloadMediaAsset::dispatch($asset->id);

        return response()->json(['message' => 'Media sedang diambil.', 'asset_id' => $asset->id], 201);
    }
}