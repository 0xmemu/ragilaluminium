<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\DownloadMediaAsset;
use App\Jobs\ProcessUploadedMediaAsset;
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
    /**
     * Batas jumlah sidik jari per permintaan pemeriksaan duplikat. Selaras
     * MAX_CHECKSUMS_PER_REQUEST di resources/js/lib/media-duplicate.ts.
     */
    private const MAX_CHECKSUMS = 50;

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
            'status' => 'pending',
            'visibility' => 'visible',
            'folder_id' => $validated['folder_id'] ?? null,
            'created_by_user_id' => $request->user()->id,
        ]);

        // Pipeline WebP: generate derivatives via queue (sama dgn banner/galeri).
        ProcessUploadedMediaAsset::dispatch($asset->id);

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
            if (filled($validated['folder_id'] ?? null)) {
                $existing->update(['folder_id' => (int) $validated['folder_id']]);
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

    /**
     * Periksa sidik jari berkas SEBELUM diunggah (kontrak owner 2026-10-08).
     *
     * Dipakai klien untuk memperingatkan admin saat berkas yang dipilih sudah ada
     * di Media Library, supaya berkas identik tidak dikirim sama sekali. Penjagaan
     * di sisi server tidak bisa menggantikan ini: pada saat server sudah bisa
     * memeriksa, berkasnya telanjur terkirim.
     *
     * Hanya aset yang masih hidup yang dihitung duplikat. Aset berstatus arsip
     * sengaja dilewati, karena aset arsip tidak lagi tayang dan berkasnya sudah
     * dihapus dari penyimpanan, jadi mengunggahnya lagi justru wajar: hasilnya
     * menjadi aset baru yang segar.
     *
     * Bentuk sidik jarinya divalidasi ketat supaya endpoint ini tidak bisa dipakai
     * menyisir nilai checksum sembarangan.
     */
    public function checkDuplicates(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'checksums' => ['required', 'array', 'max:'.self::MAX_CHECKSUMS],
            'checksums.*' => ['string', 'regex:/^[a-f0-9]{64}$/'],
        ]);

        $checksums = array_values(array_unique($validated['checksums']));

        $duplikat = MediaAsset::query()
            ->whereIn('checksum', $checksums)
            ->whereNotNull('checksum')
            ->where('checksum', '!=', '')
            ->where('status', '!=', 'archived')
            ->withCount(['attachments as usage_count' => fn ($query) => $query->where('visibility', '!=', 'archived')])
            ->get(['id', 'checksum', 'label', 'kind', 'status'])
            ->keyBy('checksum');

        return response()->json([
            'duplicates' => $duplikat
                ->map(fn (MediaAsset $asset) => [
                    'id' => (int) $asset->id,
                    'label' => (string) $asset->label,
                    'kind' => (string) $asset->kind,
                    'status' => (string) $asset->status,
                    'usage_count' => (int) $asset->usage_count,
                    'thumb_url' => $asset->urlFor('thumb'),
                ])
                ->all(),
        ]);
    }
}