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

        // Kontrak owner 2026-10-14: impor URL dari Media Library SELALU membuat
        // aset baru di folder yang dipilih. Dulu URL yang sudah ada dipakai ulang,
        // dan aset lama itu bahkan dipindahkan ke folder baru, sehingga menambahkan
        // media ke folder produk B bisa mengosongkan folder produk A tanpa disadari.
        // Idempotensi impor massal (XLSX/Shopee) tetap dijaga di MediaAssetResolver,
        // karena di sana satu berkas sumber memang harus dipakai ulang.
        $hash = hash('sha256', $validated['source_url']);

        // Kolom source_url_hash masih unik karena dipakai jalur impor massal untuk
        // memakai ulang berkas sumber yang sama (lihat MediaAssetResolver). Aset
        // dari Media Library tidak boleh merebut hash itu: kalau URL-nya sudah
        // pernah diimpor, hash dibiarkan kosong supaya penambahan media ke folder
        // tetap berhasil dan impor lama tidak ikut terpengaruh.
        $hashSudahDipakai = MediaAsset::where('source_url_hash', $hash)->exists();

        $asset = MediaAsset::create([
            'kind' => 'image',
            'label' => basename(parse_url($validated['source_url'], PHP_URL_PATH) ?: 'media'),
            'source_url' => $validated['source_url'],
            'source_url_hash' => $hashSudahDipakai ? null : $hash,
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
}
