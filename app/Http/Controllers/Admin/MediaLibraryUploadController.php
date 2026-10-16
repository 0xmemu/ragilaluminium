<?php

namespace App\Http\Controllers\Admin;

use App\Support\ByteSize;

use App\Http\Controllers\Controller;
use App\Jobs\DownloadMediaAsset;
use App\Jobs\ProcessUploadedMediaAsset;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\MediaUploadIntent;
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
            // Opsional. Niat unggah yang dibuat klien SEBELUM berkas dikirim,
            // dipakai untuk mencatat hasil. Tidak memengaruhi izin mengunggah:
            // berkas tetap diproses walau id-nya tidak dikirim atau tidak dikenal.
            'intent_id' => ['nullable', 'integer'],
        ]);

        $intentId = isset($validated['intent_id']) ? (int) $validated['intent_id'] : null;
        $userId = (int) $request->user()->id;

        $file = $request->file('media');
        $mime = strtolower((string) $file->getMimeType());
        $kind = str_starts_with($mime, 'video/') ? 'video' : 'image';

        $allowed = $kind === 'video'
            ? (array) config('media.allowed_video_mime', [])
            : (array) config('media.allowed_mime', []);
        if (! in_array($mime, $allowed, true)) {
            $pesan = "Tipe file tidak diizinkan: {$mime}";
            $this->catatHasilNiat($intentId, $userId, MediaUploadIntent::STATUS_FAILED, null, $pesan);

            return response()->json(['message' => $pesan], 422);
        }

        $maxBytes = $kind === 'video'
            ? (int) config('media.max_video_bytes', 50 * 1024 * 1024)
            : (int) config('media.max_bytes', 10 * 1024 * 1024);
        if ($file->getSize() > $maxBytes) {
            $pesan = 'Ukuran berkas melebihi batas '.ByteSize::human($maxBytes).'.';
            $this->catatHasilNiat($intentId, $userId, MediaUploadIntent::STATUS_FAILED, null, $pesan);

            return response()->json(['message' => $pesan], 422);
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

        $this->catatHasilNiat($intentId, $userId, MediaUploadIntent::STATUS_DONE, (int) $asset->id);

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

    /**
     * Catat niat unggah satu aksi (dipanggil klien SEBELUM berkas dikirim).
     *
     * Ini yang memberi jejak pada fase yang sebelumnya tidak tercatat: bila tab
     * ditutup di tengah unggahan, barisnya tetap ada dan penyapu
     * `media:close-stale-intents` menandainya terputus, sehingga admin tahu
     * berkas mana yang perlu diunggah ulang alih-alih kehilangan jejaknya.
     *
     * Satu baris per berkas, dikelompokkan oleh `client_batch_id`.
     */
    public function intents(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_batch_id' => ['required', 'string', 'max:64'],
            'folder_id' => ['nullable', 'integer', Rule::exists('media_folders', 'id')],
            'files' => ['required', 'array', 'min:1', 'max:200'],
            'files.*.name' => ['required', 'string', 'max:255'],
            'files.*.size_bytes' => ['required', 'integer', 'min:0'],
            'files.*.checksum' => ['nullable', 'string', 'regex:/^[a-f0-9]{64}$/'],
        ]);

        $userId = (int) $request->user()->id;
        $folderId = $validated['folder_id'] ?? null;
        $batchId = $validated['client_batch_id'];

        $ids = [];
        foreach ($validated['files'] as $berkas) {
            $intent = MediaUploadIntent::create([
                'user_id' => $userId,
                'folder_id' => $folderId,
                'client_batch_id' => $batchId,
                'file_name' => $berkas['name'],
                'size_bytes' => (int) $berkas['size_bytes'],
                'checksum' => $berkas['checksum'] ?? null,
                'status' => MediaUploadIntent::STATUS_UPLOADING,
            ]);
            $ids[] = (int) $intent->id;
        }

        return response()->json(['intent_ids' => $ids], 201);
    }

    /**
     * Buang catatan niat unggah milik pengguna yang sedang masuk.
     *
     * Dipakai tombol "Mengerti" pada pemberitahuan unggahan tertinggal: setelah
     * admin membacanya, catatannya tidak perlu lagi tampil. Hanya baris milik
     * pengguna sendiri yang boleh dibuang.
     */
    public function hapusIntents(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer'],
        ]);

        $dihapus = MediaUploadIntent::query()
            ->whereIn('id', $validated['ids'])
            ->where('user_id', (int) $request->user()->id)
            ->delete();

        return response()->json(['deleted' => $dihapus]);
    }

    /**
     * Catat hasil unggah pada niat yang dibuat klien.
     *
     * Niat bersifat OPSIONAL: kalau id-nya tidak dikirim, tidak dikenal, atau
     * milik pengguna lain, unggahan tetap harus berhasil. Karena itu kegagalan di
     * sini ditelan, bukan diteruskan.
     */
    private function catatHasilNiat(
        ?int $intentId,
        int $userId,
        string $status,
        ?int $assetId = null,
        ?string $alasan = null,
    ): void {
        if ($intentId === null) {
            return;
        }

        try {
            MediaUploadIntent::query()
                ->whereKey($intentId)
                ->where('user_id', $userId)
                ->update([
                    'status' => $status,
                    'media_asset_id' => $assetId,
                    'error_reason' => $alasan,
                    'updated_at' => now(),
                ]);
        } catch (\Throwable) {
            // Jejak niat tidak boleh menggagalkan unggahan yang sudah berhasil.
        }
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
